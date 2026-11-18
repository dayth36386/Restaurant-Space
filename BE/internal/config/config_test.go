package config

import "testing"

func baseEnv(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("MYSQL_PASSWORD", "x")
	t.Setenv("S3_ACCESS_KEY_ID", "x")
	t.Setenv("S3_SECRET_ACCESS_KEY", "x")
}

func TestTrustedProxies(t *testing.T) {
	baseEnv(t)
	t.Setenv("TRUSTED_PROXIES", " 172.30.0.0/24, 10.0.0.5 ")
	c, e := LoadConfig()
	if e != nil || len(c.TrustedProxies) != 2 || c.TrustedProxies[1] != "10.0.0.5" {
		t.Fatalf("got %v %v", c.TrustedProxies, e)
	}
	t.Setenv("TRUSTED_PROXIES", "caddy")
	if _, e := LoadConfig(); e == nil {
		t.Fatal("hostname accepted as trusted proxy")
	}
}

func TestSMTPCredentialsNeedTLS(t *testing.T) {
	baseEnv(t)
	t.Setenv("SMTP_USERNAME", "apikey")
	t.Setenv("SMTP_TLS", "none")
	if _, e := LoadConfig(); e == nil {
		t.Fatal("credentials over plaintext SMTP accepted")
	}
	t.Setenv("SMTP_TLS", "starttls")
	if _, e := LoadConfig(); e != nil {
		t.Fatal(e)
	}
	t.Setenv("SMTP_TLS", "ssl")
	if _, e := LoadConfig(); e == nil {
		t.Fatal("unknown SMTP_TLS accepted")
	}
}
