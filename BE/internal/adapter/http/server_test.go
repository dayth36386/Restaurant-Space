package httpadapter

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"restaurant-space/api/docs"
	"restaurant-space/api/internal/adapter/security"
	"restaurant-space/api/internal/usecase"
)

func TestProtectedRoutesAndJWT(t *testing.T) {
	cfg := Options{Origin: "http://localhost:3000", PublicURL: "http://localhost:8080", Docs: true}
	s := New(usecase.New(usecase.Dependencies{Tokens: security.JWT{Secret: strings.Repeat("x", 32)}}), cfg)
	r := s.Router()
	cases := []struct{ method, path, body string }{{"GET", "/api/v1/users/me", ""}, {"POST", "/api/v1/restaurants", "{}"}, {"POST", "/api/v1/uploads/images", ""}}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != 401 {
			t.Fatalf("%s: %d %s", tc.path, w.Code, w.Body)
		}
	}
	for _, method := range []jwt.SigningMethod{jwt.SigningMethodHS256, jwt.SigningMethodHS512} {
		token := jwt.NewWithClaims(method, jwt.MapClaims{"sub": "test", "iss": "restaurant-space", "aud": "restaurant-api", "exp": time.Now().Add(time.Hour).Unix()})
		raw, _ := token.SignedString([]byte("wrong-secret"))
		req := httptest.NewRequest("GET", "/api/v1/restaurants", nil)
		req.Header.Set("Authorization", "Bearer "+raw)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != 401 {
			t.Fatalf("invalid JWT accepted: %d", w.Code)
		}
	}
	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", nil)
	req.Header.Set("Origin", "https://evil.test")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatal("cross-origin refresh accepted")
	}
}
func TestOpenAPIMatchesRoutes(t *testing.T) {
	var spec struct {
		OpenAPI string                                `json:"openapi"`
		Paths   map[string]map[string]json.RawMessage `json:"paths"`
	}
	if e := json.Unmarshal(docs.OpenAPI, &spec); e != nil {
		t.Fatal(e)
	}
	if spec.OpenAPI != "3.1.0" {
		t.Fatal("wrong spec version")
	}
	r := New(nil, Options{Docs: true}).Router()
	param := regexp.MustCompile(`:([A-Za-z]+)`)
	seen := map[string]bool{}
	for _, route := range r.Routes() {
		if route.Path == "/docs" || route.Path == "/openapi.json" {
			continue
		}
		path := param.ReplaceAllString(route.Path, "{$1}")
		method := strings.ToLower(route.Method)
		if _, ok := spec.Paths[path][method]; !ok {
			t.Errorf("undocumented %s %s", method, path)
		}
		seen[method+" "+path] = true
	}
	for path, methods := range spec.Paths {
		for method := range methods {
			if !seen[method+" "+path] {
				t.Errorf("unimplemented %s %s", method, path)
			}
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/openapi.json", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 200 || !json.Valid(w.Body.Bytes()) {
		t.Fatal("invalid OpenAPI response")
	}
}

// Behind a trusted proxy each forwarded client gets its own auth bucket; an
// untrusted peer cannot spoof X-Forwarded-For to dodge the limit.
func TestAuthRateLimitUsesTrustedProxyClientIP(t *testing.T) {
	login := func(r http.Handler, peer, forwarded string) int {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		req.RemoteAddr = peer + ":40000"
		req.Header.Set("X-Forwarded-For", forwarded)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	behindProxy := New(nil, Options{TrustedProxies: []string{"172.30.0.0/24"}}).Router()
	for i := 0; i < 25; i++ {
		if code := login(behindProxy, "172.30.0.2", fmt.Sprintf("203.0.113.%d", i)); code == 429 {
			t.Fatalf("client %d throttled by another client's bucket", i)
		}
	}
	direct := New(nil, Options{}).Router()
	limited := false
	for i := 0; i < 25; i++ {
		if login(direct, "198.51.100.7", fmt.Sprintf("203.0.113.%d", i)) == 429 {
			limited = true
		}
	}
	if !limited {
		t.Fatal("spoofed X-Forwarded-For from an untrusted peer bypassed the rate limit")
	}
}
