package google

import (
	"context"
	"errors"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"

	"restaurant-space/api/internal/port"
)

type Provider struct{ ClientID, ClientSecret, RedirectURL string }

func (p Provider) config() oauth2.Config {
	//nolint:gosec // G101: public Google OAuth endpoint URLs, not credentials.
	return oauth2.Config{ClientID: p.ClientID, ClientSecret: p.ClientSecret, RedirectURL: p.RedirectURL, Scopes: []string{oidc.ScopeOpenID, "email", "profile"}, Endpoint: oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/v2/auth", TokenURL: "https://oauth2.googleapis.com/token"}}
}
func (p Provider) AuthorizationURL(state, nonce, challenge string) (string, error) {
	cfg := p.config()
	return cfg.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.SetAuthURLParam("code_challenge", challenge), oauth2.SetAuthURLParam("code_challenge_method", "S256")), nil
}
func (p Provider) Exchange(ctx context.Context, code, pkce, nonce string) (out port.GoogleIdentity, e error) {
	cfg := p.config()
	token, e := cfg.Exchange(ctx, code, oauth2.VerifierOption(pkce))
	if e != nil {
		return out, e
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return out, errors.New("missing id token")
	}
	verifier := oidc.NewVerifier("https://accounts.google.com", oidc.NewRemoteKeySet(ctx, "https://www.googleapis.com/oauth2/v3/certs"), &oidc.Config{ClientID: p.ClientID})
	identity, e := verifier.Verify(ctx, raw)
	if e != nil {
		return out, e
	}
	if identity.Nonce != nonce {
		return out, errors.New("invalid nonce")
	}
	var claims struct {
		Email    string `json:"email"`
		Verified bool   `json:"email_verified"`
		Name     string `json:"name"`
	}
	if e = identity.Claims(&claims); e != nil {
		return out, e
	}
	if !claims.Verified {
		return out, errors.New("unverified email")
	}
	return port.GoogleIdentity{Subject: identity.Subject, Email: claims.Email, Name: claims.Name}, nil
}

var _ port.GoogleProvider = Provider{}
