package httpadapter

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/usecase"
)

func (s *Server) cookie(c *gin.Context, name, value, path string, age int) {
	// Secure comes from config: false only for local HTTP development.
	//nolint:gosec // G124
	http.SetCookie(c.Writer, &http.Cookie{Name: name, Value: value, Path: path, MaxAge: age, HttpOnly: true, Secure: s.Options.SecureCookies, SameSite: http.SameSiteLaxMode})
}
func (s *Server) authResponse(c *gin.Context, status int, out usecase.AuthResult, e error) {
	if e != nil {
		fail(c, e)
		return
	}
	s.cookie(c, "refresh_token", out.RefreshToken, "/api/v1/auth", 30*86400)
	c.JSON(status, out)
}
func (s *Server) register(c *gin.Context) {
	var in usecase.RegisterInput
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.Register(c.Request.Context(), in)
	s.authResponse(c, 201, out, e)
}
func (s *Server) login(c *gin.Context) {
	var in usecase.LoginInput
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.Login(c.Request.Context(), in)
	s.authResponse(c, 200, out, e)
}
func (s *Server) refresh(c *gin.Context) {
	raw, _ := c.Cookie("refresh_token")
	out, e := s.app.Refresh(c.Request.Context(), raw)
	if errors.Is(e, domain.ErrUnauthorized) {
		s.cookie(c, "refresh_token", "", "/api/v1/auth", -1)
	}
	s.authResponse(c, 200, out, e)
}
func (s *Server) logout(c *gin.Context) {
	raw, _ := c.Cookie("refresh_token")
	if e := s.app.Logout(c.Request.Context(), raw); e != nil {
		fail(c, e)
		return
	}
	s.cookie(c, "refresh_token", "", "/api/v1/auth", -1)
	c.Status(204)
}
func (s *Server) forgotPassword(c *gin.Context) {
	var in struct {
		Email string `json:"email"`
	}
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	if e := s.app.ForgotPassword(c.Request.Context(), in.Email); e != nil {
		fail(c, e)
		return
	}
	c.JSON(202, gin.H{"message": "If the account exists, a reset email has been sent"})
}
func (s *Server) resetPassword(c *gin.Context) {
	var in usecase.ResetInput
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	if e := s.app.ResetPassword(c.Request.Context(), in); e != nil {
		fail(c, e)
		return
	}
	s.cookie(c, "refresh_token", "", "/api/v1/auth", -1)
	c.Status(204)
}
func (s *Server) googleStart(c *gin.Context) {
	out, e := s.app.GoogleStart(c.Request.Context())
	if e != nil {
		fail(c, e)
		return
	}
	s.cookie(c, "oauth_state", out.State, "/api/v1/auth/google", 600)
	c.Redirect(302, out.URL)
}
func (s *Server) googleCallback(c *gin.Context) {
	cookie, _ := c.Cookie("oauth_state")
	s.cookie(c, "oauth_state", "", "/api/v1/auth/google", -1)
	out, e := s.app.GoogleCallback(c.Request.Context(), c.Query("state"), cookie, c.Query("code"))
	s.authResponse(c, 200, out, e)
}
