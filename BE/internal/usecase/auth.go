package usecase

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9_]{3,50}$`)

func validPassword(p string) bool { return len(p) >= 10 && len(p) <= 72 }
func validEmail(s string) bool {
	a, e := mail.ParseAddress(s)
	return e == nil && a.Address == s && len(s) <= 254 && !strings.ContainsAny(s, "\r\n")
}

type RegisterInput struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}
type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type ResetInput struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}
type AuthResult struct {
	AccessToken  string      `json:"access_token"`
	TokenType    string      `json:"token_type"`
	ExpiresIn    int         `json:"expires_in"`
	User         domain.User `json:"user"`
	RefreshToken string      `json:"-"`
}

func (s *Service) Authenticate(ctx context.Context, raw string) (string, error) {
	user, family, e := s.tokens.Verify(raw)
	if e != nil {
		return "", domain.ErrUnauthorized
	}
	ok, e := s.db.Repository(ctx).ActiveFamily(user, family, time.Now().UTC())
	if e != nil {
		return "", e
	}
	if !ok {
		return "", domain.ErrUnauthorized
	}
	return user, nil
}
func (s *Service) newSession(r port.Repository, user, family string) (domain.RefreshSession, string, error) {
	if family == "" {
		family = newID()
	}
	raw := randomToken()
	v := domain.RefreshSession{ID: newID(), UserID: user, FamilyID: family, TokenHash: digest(raw), ExpiresAt: time.Now().UTC().Add(30 * 24 * time.Hour)}
	e := r.CreateSession(&v)
	return v, raw, e
}
func (s *Service) authResult(u domain.User, v domain.RefreshSession, raw string) (AuthResult, error) {
	access, e := s.tokens.Sign(u.ID, v.FamilyID, time.Now().UTC())
	return AuthResult{access, "Bearer", 900, u, raw}, e
}
func (s *Service) Register(ctx context.Context, in RegisterInput) (out AuthResult, e error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Username = strings.ToLower(strings.TrimSpace(in.Username))
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if !validEmail(in.Email) || !validPassword(in.Password) || !usernamePattern.MatchString(in.Username) || len([]rune(in.DisplayName)) < 1 || len([]rune(in.DisplayName)) > 100 {
		return out, bad("Invalid email, username, display_name or password (10-72 bytes)")
	}
	hash, e := s.passwords.Hash(in.Password)
	if e != nil {
		return out, e
	}
	u := domain.User{ID: newID(), Email: in.Email, Username: in.Username, DisplayName: in.DisplayName, PasswordHash: &hash, Role: "USER", Status: "ACTIVE"}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if e := r.CreateUser(&u); e != nil {
			return e
		}
		v, raw, e := s.newSession(r, u.ID, "")
		if e != nil {
			return e
		}
		out, e = s.authResult(u, v, raw)
		return e
	})
	return
}

const dummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

func (s *Service) Login(ctx context.Context, in LoginInput) (out AuthResult, e error) {
	u, e := s.db.Repository(ctx).UserByEmail(strings.ToLower(strings.TrimSpace(in.Email)))
	hash := dummyHash
	if e == nil && u.PasswordHash != nil {
		hash = *u.PasswordHash
	}
	ok := s.passwords.Compare(hash, in.Password)
	if e != nil && !errors.Is(e, domain.ErrNotFound) {
		return out, e
	}
	if e != nil || !active(u) || u.PasswordHash == nil || !ok {
		return out, domain.ErrUnauthorized
	}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		locked, e := r.User(u.ID, true)
		if e != nil {
			return e
		}
		if !active(locked) || locked.PasswordHash == nil || *locked.PasswordHash != hash {
			return domain.ErrUnauthorized
		}
		v, raw, e := s.newSession(r, u.ID, "")
		if e != nil {
			return e
		}
		out, e = s.authResult(locked, v, raw)
		return e
	})
	return
}
func (s *Service) Refresh(ctx context.Context, raw string) (out AuthResult, e error) {
	if raw == "" {
		return out, domain.ErrUnauthorized
	}
	old, e := s.db.Repository(ctx).SessionByHash(digest(raw))
	if errors.Is(e, domain.ErrNotFound) {
		return out, domain.ErrUnauthorized
	}
	if e != nil {
		return out, e
	}
	invalid := false
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		u, e := r.User(old.UserID, true)
		if e != nil {
			return e
		}
		old, e = r.Session(old.ID, true)
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		if old.RevokedAt != nil || !old.ExpiresAt.After(now) || !active(u) {
			invalid = true
			return r.RevokeFamily(old.FamilyID, now)
		}
		next, nextRaw, e := s.newSession(r, u.ID, old.FamilyID)
		if e != nil {
			return e
		}
		old.RevokedAt = &now
		old.ReplacedByID = &next.ID
		if e = r.SaveSession(&old); e != nil {
			return e
		}
		out, e = s.authResult(u, next, nextRaw)
		return e
	})
	if e == nil && invalid {
		e = domain.ErrUnauthorized
	}
	return
}
func (s *Service) Logout(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	session, e := s.db.Repository(ctx).SessionByHash(digest(raw))
	if errors.Is(e, domain.ErrNotFound) {
		return nil
	}
	if e != nil {
		return e
	}
	return s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := r.User(session.UserID, true); e != nil {
			return e
		}
		return r.RevokeFamily(session.FamilyID, time.Now().UTC())
	})
}
func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if !validEmail(email) {
		return bad("Invalid email")
	}
	if s.mail == nil {
		return &domain.Error{Code: "MAIL_UNAVAILABLE", Message: "Password reset mail is not configured"}
	}
	u, e := s.db.Repository(ctx).UserByEmail(email)
	if errors.Is(e, domain.ErrNotFound) {
		return nil
	}
	if e != nil {
		return e
	}
	if !active(u) {
		return nil
	}
	raw := randomToken()
	v := domain.PasswordResetToken{ID: newID(), UserID: u.ID, TokenHash: digest(raw), ExpiresAt: time.Now().UTC().Add(30 * time.Minute)}
	if e = s.db.Repository(ctx).CreateReset(&v); e != nil {
		return e
	}
	link, e := url.Parse(s.resetURL)
	if e != nil {
		return e
	}
	q := link.Query()
	q.Set("token", raw)
	link.RawQuery = q.Encode()
	if e = s.mail.SendReset(ctx, u.Email, link.String()); e != nil {
		return &domain.Error{Code: "MAIL_UNAVAILABLE", Message: "Unable to send reset email"}
	}
	return nil
}
func (s *Service) ResetPassword(ctx context.Context, in ResetInput) error {
	if !validPassword(in.Password) || len(in.Token) != 43 {
		return bad("Invalid token or password")
	}
	row, e := s.db.Repository(ctx).ResetByHash(digest(in.Token))
	if errors.Is(e, domain.ErrNotFound) {
		return bad("Invalid or expired reset token")
	}
	if e != nil {
		return e
	}
	hash, e := s.passwords.Hash(in.Password)
	if e != nil {
		return e
	}
	return s.db.Transaction(ctx, func(r port.Repository) error {
		u, e := r.User(row.UserID, true)
		if e != nil {
			return e
		}
		if !active(u) {
			return bad("Invalid reset token")
		}
		row, e = r.ResetToken(row.ID, true)
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		if row.UsedAt != nil || !row.ExpiresAt.After(now) {
			return bad("Invalid or expired reset token")
		}
		u.PasswordHash = &hash
		if e = r.SaveUser(&u); e != nil {
			return e
		}
		if e = r.ConsumeResets(u.ID, now); e != nil {
			return e
		}
		return r.RevokeUserSessions(u.ID, now)
	})
}

type GoogleStartResult struct{ State, URL string }

func (s *Service) GoogleStart(ctx context.Context) (GoogleStartResult, error) {
	if s.google == nil {
		return GoogleStartResult{}, &domain.Error{Code: "OAUTH_UNAVAILABLE", Message: "Google login is not configured"}
	}
	state, nonce, verifier := randomToken(), randomToken(), randomToken()
	challenge := base64.RawURLEncoding.EncodeToString(digest(verifier))
	link, e := s.google.AuthorizationURL(state, nonce, challenge)
	if e != nil {
		return GoogleStartResult{}, e
	}
	row := domain.OauthState{ID: newID(), StateHash: digest(state), Nonce: nonce, Verifier: verifier, ExpiresAt: time.Now().UTC().Add(10 * time.Minute)}
	e = s.db.Repository(ctx).CreateOAuthState(&row)
	return GoogleStartResult{state, link}, e
}
func (s *Service) GoogleCallback(ctx context.Context, state, cookie, code string) (out AuthResult, e error) {
	if len(state) != 43 || subtle.ConstantTimeCompare([]byte(state), []byte(cookie)) != 1 || code == "" {
		return out, bad("Invalid OAuth state or code")
	}
	if s.google == nil {
		return out, domain.ErrUnauthorized
	}
	var row domain.OauthState
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		var e error
		row, e = r.ConsumeOAuthState(digest(state), time.Now().UTC())
		return e
	})
	if errors.Is(e, domain.ErrNotFound) {
		return out, bad("OAuth state expired or used")
	}
	if e != nil {
		return out, e
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	identity, e := s.google.Exchange(ctx, code, row.Verifier, row.Nonce)
	if e != nil || !validEmail(identity.Email) {
		return out, domain.ErrUnauthorized
	}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		account, e := r.OAuthAccount(identity.Subject)
		var u domain.User
		if e == nil {
			u, e = r.User(account.UserID, true)
			if e != nil {
				return e
			}
			if !active(u) {
				return domain.ErrUnauthorized
			}
		} else if errors.Is(e, domain.ErrNotFound) {
			_, e = r.UserByEmail(strings.ToLower(identity.Email))
			if e == nil {
				return &domain.Error{Code: "ACCOUNT_EXISTS", Message: "Sign in with your existing account; automatic account linking is disabled"}
			}
			if !errors.Is(e, domain.ErrNotFound) {
				return e
			}
			name := []rune(strings.TrimSpace(identity.Name))
			if len(name) > 100 {
				name = name[:100]
			}
			if len(name) == 0 {
				name = []rune("User")
			}
			now := time.Now().UTC()
			u = domain.User{ID: newID(), Email: strings.ToLower(identity.Email), Username: "user_" + strings.ReplaceAll(newID(), "-", "")[:20], DisplayName: string(name), Role: "USER", Status: "ACTIVE", EmailVerifiedAt: &now}
			if e = r.CreateUser(&u); e != nil {
				return e
			}
			account = domain.OauthAccount{ID: newID(), UserID: u.ID, Provider: "google", ProviderUserID: identity.Subject}
			if e = r.CreateOAuthAccount(&account); e != nil {
				return e
			}
		} else {
			return e
		}
		session, raw, e := s.newSession(r, u.ID, "")
		if e != nil {
			return e
		}
		out, e = s.authResult(u, session, raw)
		return e
	})
	return
}
