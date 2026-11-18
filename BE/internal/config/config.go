package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Address, DBHost, DBName, DBUser, DBPassword, JWTSecret, Origin, PublicURL string
	SecureCookies, Docs                                                       bool
	S3Endpoint, S3PublicEndpoint, S3Region, S3Bucket, S3Key, S3Secret         string
	GoogleID, GoogleSecret, GoogleRedirect                                    string
	SMTPAddress, SMTPFrom, ResetURL                                           string
	SMTPUsername, SMTPPassword, SMTPTLS                                       string
	// TrustedProxies are reverse proxies (IPs or CIDRs) whose X-Forwarded-For is
	// believed for client IPs; empty means the socket peer is the client.
	TrustedProxies []string
}

func splitList(raw string) []string {
	var out []string
	for _, v := range strings.Split(raw, ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
func LoadConfig() (Config, error) {
	c := Config{
		Address: env("HTTP_ADDR", ":8080"), DBHost: env("DB_HOST", "localhost:3306"), DBName: env("MYSQL_DATABASE", "restaurant_space"), DBUser: env("MYSQL_USER", "restaurant"), DBPassword: os.Getenv("MYSQL_PASSWORD"),
		JWTSecret: os.Getenv("JWT_SECRET"), Origin: env("WEB_ORIGIN", "http://localhost:3000"), PublicURL: env("API_PUBLIC_URL", "http://localhost:8080"), SecureCookies: env("COOKIE_SECURE", "true") == "true", Docs: env("ENABLE_API_DOCS", "false") == "true",
		S3Endpoint: env("S3_ENDPOINT", "http://localhost:9000"), S3PublicEndpoint: env("S3_PUBLIC_ENDPOINT", "http://localhost:9000"), S3Region: env("S3_REGION", "us-east-1"), S3Bucket: env("S3_BUCKET", "restaurant-images"), S3Key: os.Getenv("S3_ACCESS_KEY_ID"), S3Secret: os.Getenv("S3_SECRET_ACCESS_KEY"),
		GoogleID: os.Getenv("GOOGLE_CLIENT_ID"), GoogleSecret: os.Getenv("GOOGLE_CLIENT_SECRET"), GoogleRedirect: env("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		SMTPAddress: os.Getenv("SMTP_ADDR"), SMTPFrom: env("SMTP_FROM", "noreply@restaurant.local"), ResetURL: env("PASSWORD_RESET_URL", "http://localhost:3000/reset-password"),
		SMTPUsername: os.Getenv("SMTP_USERNAME"), SMTPPassword: os.Getenv("SMTP_PASSWORD"), SMTPTLS: env("SMTP_TLS", "none"),
		TrustedProxies: splitList(os.Getenv("TRUSTED_PROXIES")),
	}
	if len(c.JWTSecret) < 32 {
		return c, fmt.Errorf("JWT_SECRET must contain at least 32 bytes")
	}
	if c.DBPassword == "" || c.S3Key == "" || c.S3Secret == "" {
		return c, fmt.Errorf("database and S3 credentials required")
	}
	for _, raw := range []string{c.Origin, c.PublicURL, c.ResetURL, c.GoogleRedirect} {
		u, e := url.Parse(raw)
		if e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			return c, fmt.Errorf("invalid configured URL")
		}
	}
	if strings.ContainsAny(c.SMTPFrom, "\r\n") {
		return c, fmt.Errorf("invalid SMTP_FROM")
	}
	switch c.SMTPTLS {
	case "none", "starttls", "tls":
	default:
		return c, fmt.Errorf("SMTP_TLS must be none, starttls or tls")
	}
	// net/smtp refuses PLAIN auth over an unencrypted link to a remote host.
	if c.SMTPUsername != "" && c.SMTPTLS == "none" {
		return c, fmt.Errorf("SMTP_USERNAME requires SMTP_TLS=starttls or tls")
	}
	for _, p := range c.TrustedProxies {
		if net.ParseIP(p) == nil {
			if _, _, e := net.ParseCIDR(p); e != nil {
				return c, fmt.Errorf("invalid TRUSTED_PROXIES entry %q", p)
			}
		}
	}
	return c, nil
}
