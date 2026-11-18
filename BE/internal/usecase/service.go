package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

type Service struct {
	db               port.UnitOfWork
	storage          port.Storage
	passwords        port.PasswordHasher
	tokens           port.TokenSigner
	mail             port.Mailer
	google           port.GoogleProvider
	images           port.ImageProcessor
	bucket, resetURL string
}
type Dependencies struct {
	Database         port.UnitOfWork
	Storage          port.Storage
	Passwords        port.PasswordHasher
	Tokens           port.TokenSigner
	Mail             port.Mailer
	Google           port.GoogleProvider
	Images           port.ImageProcessor
	Bucket, ResetURL string
}

func New(d Dependencies) *Service {
	return &Service{db: d.Database, storage: d.Storage, passwords: d.Passwords, tokens: d.Tokens, mail: d.Mail, google: d.Google, images: d.Images, bucket: d.Bucket, resetURL: d.ResetURL}
}
func (s *Service) Ready(ctx context.Context) error {
	if e := s.db.Ready(ctx); e != nil {
		return e
	}
	return s.storage.Ready(ctx)
}
func newID() string {
	b := make([]byte, 16)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}
func validID(id string) bool {
	if len(id) != 36 || id[8] != '-' || id[13] != '-' || id[18] != '-' || id[23] != '-' {
		return false
	}
	_, e := hex.DecodeString(strings.ReplaceAll(id, "-", ""))
	return e == nil
}
func randomToken() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func digest(v string) []byte    { h := sha256.Sum256([]byte(v)); return h[:] }
func bad(message string) error  { return domain.Invalid(message) }
func active(u domain.User) bool { return u.Status == "ACTIVE" && u.DeletedAt == nil }

type Patch map[string]json.RawMessage

func mergePatch(target any, patch Patch) error {
	if patch == nil {
		return bad("Expected JSON object")
	}
	b, _ := json.Marshal(target)
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(b, &fields)
	for k, v := range patch {
		if _, ok := fields[k]; !ok {
			return bad("Unknown field: " + k)
		}
		if string(v) == "null" {
			switch k {
			case "name", "currency", "visit_status", "visibility", "display_name", "username", "sort_order", "is_cover":
				return bad(k + " cannot be null")
			}
		}
		fields[k] = v
	}
	b, _ = json.Marshal(fields)
	if e := json.Unmarshal(b, target); e != nil {
		return bad("Invalid field type")
	}
	return nil
}
