package bootstrap

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"restaurant-space/api/internal/adapter/google"
	httpadapter "restaurant-space/api/internal/adapter/http"
	imageprocessor "restaurant-space/api/internal/adapter/image"
	"restaurant-space/api/internal/adapter/mail"
	"restaurant-space/api/internal/adapter/mysql"
	"restaurant-space/api/internal/adapter/security"
	"restaurant-space/api/internal/adapter/storage"
	"restaurant-space/api/internal/config"
	"restaurant-space/api/internal/port"
	"restaurant-space/api/internal/usecase"
)

// Run is the composition root: only this package wires concrete adapters together.
func Run() error {
	cfg, e := config.LoadConfig()
	if e != nil {
		return e
	}
	db, closeDB, e := mysql.Connect(mysql.Options{Host: cfg.DBHost, Database: cfg.DBName, User: cfg.DBUser, Password: cfg.DBPassword})
	if e != nil {
		return e
	}
	defer func() { _ = closeDB() }()
	st, e := storage.New(cfg.S3Endpoint, cfg.S3PublicEndpoint, cfg.S3Region, cfg.S3Bucket, cfg.S3Key, cfg.S3Secret)
	if e != nil {
		return e
	}
	var mailer port.Mailer
	if cfg.SMTPAddress != "" {
		mailer = mail.SMTP{Address: cfg.SMTPAddress, From: cfg.SMTPFrom, Username: cfg.SMTPUsername, Password: cfg.SMTPPassword, TLS: cfg.SMTPTLS}
	}
	var googleProvider port.GoogleProvider
	if cfg.GoogleID != "" && cfg.GoogleSecret != "" {
		googleProvider = google.Provider{ClientID: cfg.GoogleID, ClientSecret: cfg.GoogleSecret, RedirectURL: cfg.GoogleRedirect}
	}
	app := usecase.New(usecase.Dependencies{Database: db, Storage: st, Passwords: security.PasswordHasher{}, Tokens: security.JWT{Secret: cfg.JWTSecret}, Mail: mailer, Google: googleProvider, Images: imageprocessor.Processor{}, Bucket: cfg.S3Bucket, ResetURL: cfg.ResetURL})
	server := httpadapter.New(app, httpadapter.Options{Origin: cfg.Origin, PublicURL: cfg.PublicURL, SecureCookies: cfg.SecureCookies, Docs: cfg.Docs, TrustedProxies: cfg.TrustedProxies})
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if len(os.Args) > 1 && os.Args[1] == "cleanup" {
		return app.Cleanup(ctx)
	}
	httpServer := &http.Server{Addr: cfg.Address, Handler: server.Router(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	errCh := make(chan error, 1)
	go func() { slog.Info("API listening", "address", cfg.Address); errCh <- httpServer.ListenAndServe() }()
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				job, cancel := context.WithTimeout(ctx, 5*time.Minute)
				if e := app.Cleanup(job); e != nil {
					slog.Error("cleanup failed", "error", e)
				}
				cancel()
			}
		}
	}()
	select {
	case e := <-errCh:
		if errors.Is(e, http.ErrServerClosed) {
			return nil
		}
		return e
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdown)
	}
}
