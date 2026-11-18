package httpadapter

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-space/api/docs"
	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/usecase"
)

type Options struct {
	Origin, PublicURL   string
	SecureCookies, Docs bool
	// TrustedProxies (validated IPs/CIDRs) may set X-Forwarded-For; see config.
	TrustedProxies []string
}
type Server struct {
	app     *usecase.Service
	Options Options
	limiter *rateLimiter
	hub     *hub
}

func New(app *usecase.Service, options Options) *Server {
	return &Server{app: app, Options: options, limiter: &rateLimiter{entries: make(map[string]rateEntry)}, hub: newHub()}
}
func bad(message string) error { return domain.Invalid(message) }
func unauthorized() error      { return domain.ErrUnauthorized }
func notFound() error          { return domain.ErrNotFound }

type apiError struct {
	status        int
	code, message string
}

func (e *apiError) Error() string { return e.message }
func fail(c *gin.Context, err error) {
	status, code, message := classify(err)
	if status == 500 {
		slog.Error("request failed", "error", err, "path", c.FullPath())
	}
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}

// classify maps domain/transport errors to an HTTP status and public error body.
func classify(err error) (status int, code, message string) {
	status, code, message = 500, "INTERNAL_ERROR", "An internal error occurred"
	var appErr *domain.Error
	var transportErr *apiError
	switch {
	case errors.As(err, &transportErr):
		status, code, message = transportErr.status, transportErr.code, transportErr.message
	case errors.As(err, &appErr):
		code, message = appErr.Code, appErr.Message
		switch code {
		case "INVALID_INPUT":
			status = 400
		case "ACCOUNT_EXISTS":
			status = 409
		case "MAIL_UNAVAILABLE", "OAUTH_UNAVAILABLE":
			status = 503
		}
	case errors.Is(err, domain.ErrNotFound):
		status, code, message = 404, "NOT_FOUND", "Resource not found"
	case errors.Is(err, domain.ErrUnauthorized):
		status, code, message = 401, "UNAUTHORIZED", "Authentication required"
	case errors.Is(err, domain.ErrConflict):
		status, code, message = 409, "CONFLICT", "Resource already exists or is referenced"
	}
	return
}
func bind(c *gin.Context, v any) error {
	if !strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		return bad("Content-Type must be application/json")
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	d := json.NewDecoder(c.Request.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return bad("Invalid JSON request")
	}
	if d.Decode(&struct{}{}) != io.EOF {
		return bad("Expected one JSON object")
	}
	return nil
}
func uid(c *gin.Context) string { return c.GetString("user_id") }
func idParam(c *gin.Context, key string) (string, error) {
	v := c.Param(key)
	if _, e := uuid.Parse(v); e != nil {
		return "", bad("Invalid UUID")
	}
	return v, nil
}
func (s *Server) Router() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	// Without trusted proxies, ClientIP is the socket peer, so a reverse proxy
	// would make every user share one auth rate-limit bucket.
	if e := r.SetTrustedProxies(s.Options.TrustedProxies); e != nil {
		slog.Error("invalid trusted proxies; ignoring X-Forwarded-For", "error", e)
		_ = r.SetTrustedProxies(nil)
	}
	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Cache-Control", "no-store")
		origin := c.GetHeader("Origin")
		if origin != "" {
			if origin != s.Options.Origin && origin != s.Options.PublicURL {
				fail(c, &apiError{403, "ORIGIN_DENIED", "Origin is not allowed"})
				return
			}
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})
	r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.GET("/readyz", s.ready)
	if s.Options.Docs {
		r.GET("/openapi.json", func(c *gin.Context) { c.Data(200, "application/json", docs.OpenAPI) })
		r.GET("/docs", func(c *gin.Context) { c.Data(200, "text/html; charset=utf-8", []byte(docs.HTML)) })
	}
	a := r.Group("/api/v1")
	auth := a.Group("/auth")
	auth.Use(s.throttle)
	auth.POST("/register", s.register)
	auth.POST("/login", s.login)
	auth.POST("/refresh", s.refresh)
	auth.POST("/logout", s.logout)
	auth.POST("/forgot-password", s.forgotPassword)
	auth.POST("/reset-password", s.resetPassword)
	auth.GET("/google", s.googleStart)
	auth.GET("/google/callback", s.googleCallback)
	a.Use(s.authenticate)
	a.GET("/feed", s.feed)
	a.GET("/restaurants", s.listRestaurants)
	a.GET("/restaurants/:id", s.restaurantDetail)
	a.GET("/users/:username", s.publicProfile)
	a.GET("/categories", s.categories)
	a.GET("/tags", s.tags)
	a.GET("/users/me", s.requireUser, s.myProfile)
	a.PATCH("/users/me", s.requireUser, s.updateProfile)
	a.POST("/restaurants", s.requireUser, s.createRestaurant)
	a.PATCH("/restaurants/:id", s.requireUser, s.updateRestaurant)
	a.DELETE("/restaurants/:id", s.requireUser, s.deleteRestaurant)
	a.POST("/restaurants/:id/images", s.requireUser, s.attachImage)
	a.PATCH("/restaurants/:id/images/:imageId", s.requireUser, s.updateImage)
	a.DELETE("/restaurants/:id/images/:imageId", s.requireUser, s.deleteImage)
	a.POST("/restaurants/:id/menus", s.requireUser, s.createMenu)
	a.PATCH("/restaurants/:id/menus/:menuId", s.requireUser, s.updateMenu)
	a.DELETE("/restaurants/:id/menus/:menuId", s.requireUser, s.deleteMenu)
	a.POST("/uploads/images", s.requireUser, s.upload)
	a.GET("/uploads/images/:id", s.requireUser, s.uploadDetail)
	a.GET("/restaurants/:id/comments", s.listComments)
	a.POST("/restaurants/:id/comments", s.requireUser, s.createComment)
	a.PATCH("/comments/:id", s.requireUser, s.updateComment)
	a.DELETE("/comments/:id", s.requireUser, s.deleteComment)
	a.POST("/restaurants/:id/likes", s.requireUser, s.like)
	a.DELETE("/restaurants/:id/likes", s.requireUser, s.unlike)
	a.GET("/conversations", s.requireUser, s.listConversations)
	a.POST("/conversations", s.requireUser, s.startConversation)
	a.GET("/conversations/:id", s.requireUser, s.conversationDetail)
	a.GET("/conversations/:id/messages", s.requireUser, s.listMessages)
	a.POST("/conversations/:id/messages", s.requireUser, s.sendMessage)
	a.POST("/conversations/:id/read", s.requireUser, s.markRead)
	// Authenticated by the first WebSocket frame, not the Authorization header.
	a.GET("/ws", s.socket)
	r.NoRoute(func(c *gin.Context) { fail(c, notFound()) })
	return r
}

func (s *Server) requireUser(c *gin.Context) {
	if uid(c) == "" {
		fail(c, unauthorized())
		return
	}
	c.Next()
}
func (s *Server) authenticate(c *gin.Context) {
	raw := c.GetHeader("Authorization")
	if raw == "" {
		c.Next()
		return
	}
	if !strings.HasPrefix(raw, "Bearer ") {
		fail(c, unauthorized())
		return
	}
	user, e := s.app.Authenticate(c.Request.Context(), strings.TrimPrefix(raw, "Bearer "))
	if e != nil {
		fail(c, e)
		return
	}
	c.Set("user_id", user)
	c.Next()
}
func (s *Server) ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	if e := s.app.Ready(ctx); e != nil {
		c.JSON(503, gin.H{"status": "unavailable"})
		return
	}
	c.JSON(200, gin.H{"status": "ready"})
}

type rateEntry struct {
	count int
	until time.Time
}
type rateLimiter struct {
	sync.Mutex
	entries map[string]rateEntry
}

func (s *Server) throttle(c *gin.Context) {
	s.limiter.Lock()
	now := time.Now()
	key := c.ClientIP()
	e := s.limiter.entries[key]
	if len(s.limiter.entries) >= 10000 {
		for k, v := range s.limiter.entries {
			if now.After(v.until) {
				delete(s.limiter.entries, k)
			}
		}
		if _, known := s.limiter.entries[key]; !known && len(s.limiter.entries) >= 10000 {
			s.limiter.Unlock()
			fail(c, &apiError{429, "RATE_LIMITED", "Too many requests"})
			return
		}
	}
	if now.After(e.until) {
		e = rateEntry{0, now.Add(time.Minute)}
	}
	e.count++
	s.limiter.entries[key] = e
	if len(s.limiter.entries) > 10000 {
		for k, v := range s.limiter.entries {
			if now.After(v.until) {
				delete(s.limiter.entries, k)
			}
		}
	}
	s.limiter.Unlock()
	if e.count > 20 {
		c.Header("Retry-After", "60")
		fail(c, &apiError{429, "RATE_LIMITED", "Too many requests"})
		return
	}
	c.Next()
}
