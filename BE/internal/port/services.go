package port

import (
	"context"
	"io"
	"time"
)

type Storage interface {
	Put(context.Context, string, io.Reader, int64, string) error
	URL(context.Context, string) (string, error)
	Delete(context.Context, string) error
	Ready(context.Context) error
}
type PasswordHasher interface {
	Hash(string) (string, error)
	Compare(string, string) bool
}
type TokenSigner interface {
	Sign(string, string, time.Time) (string, error)
	Verify(string) (string, string, error)
}
type Mailer interface {
	SendReset(context.Context, string, string) error
}
type GoogleIdentity struct{ Subject, Email, Name string }
type GoogleProvider interface {
	AuthorizationURL(string, string, string) (string, error)
	Exchange(context.Context, string, string, string) (GoogleIdentity, error)
}
type ImageProcessor interface {
	Normalize([]byte) ([]byte, int, int, error)
}
