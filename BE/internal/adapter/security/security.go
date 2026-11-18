package security

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"restaurant-space/api/internal/port"
)

type PasswordHasher struct{}

func (PasswordHasher) Hash(password string) (string, error) {
	v, e := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(v), e
}
func (PasswordHasher) Compare(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

type JWT struct{ Secret string }

func (j JWT) Sign(user, family string, now time.Time) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": user, "fid": family, "iss": "restaurant-space", "aud": "restaurant-api", "iat": now.Unix(), "exp": now.Add(15 * time.Minute).Unix()}).SignedString([]byte(j.Secret))
}
func (j JWT) Verify(raw string) (string, string, error) {
	claims := jwt.MapClaims{}
	t, e := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) { return []byte(j.Secret), nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("restaurant-space"), jwt.WithAudience("restaurant-api"), jwt.WithExpirationRequired())
	if e != nil {
		return "", "", e
	}
	if !t.Valid {
		return "", "", errors.New("invalid token")
	}
	user, _ := claims.GetSubject()
	family, _ := claims["fid"].(string)
	if user == "" || family == "" {
		return "", "", errors.New("invalid token claims")
	}
	return user, family, nil
}

var _ port.PasswordHasher = PasswordHasher{}
var _ port.TokenSigner = JWT{}
