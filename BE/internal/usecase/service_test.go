package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

// Embed unused methods so a test fails loudly if the use case gains an unexpected dependency.
type fakeRepository struct {
	port.Repository
	user                                 domain.User
	restaurant                           domain.Restaurant
	session                              domain.RefreshSession
	revoked, saved, committed, mediaRead bool
	insertErr                            error
}

func (f *fakeRepository) User(string, bool) (domain.User, error) { return f.user, nil }
func (f *fakeRepository) Restaurant(string, bool) (domain.Restaurant, error) {
	return f.restaurant, nil
}
func (f *fakeRepository) SessionByHash([]byte) (domain.RefreshSession, error) { return f.session, nil }
func (f *fakeRepository) Session(string, bool) (domain.RefreshSession, error) { return f.session, nil }
func (f *fakeRepository) RevokeFamily(string, time.Time) error                { f.revoked = true; return nil }
func (f *fakeRepository) CreateSession(v *domain.RefreshSession) error        { return f.insertErr }
func (f *fakeRepository) SaveSession(v *domain.RefreshSession) error {
	f.saved = true
	f.session = *v
	return nil
}
func (f *fakeRepository) SaveRestaurant(v *domain.Restaurant) error {
	f.saved = true
	f.restaurant = *v
	return nil
}
func (f *fakeRepository) MediaObject(string, bool) (domain.MediaObject, error) {
	f.mediaRead = true
	return domain.MediaObject{}, nil
}

type fakeUnitOfWork struct{ r *fakeRepository }

func (f fakeUnitOfWork) Repository(context.Context) port.Repository { return f.r }
func (f fakeUnitOfWork) Transaction(_ context.Context, fn func(port.Repository) error) error {
	e := fn(f.r)
	f.r.committed = e == nil
	return e
}
func (f fakeUnitOfWork) Ready(context.Context) error { return nil }

type fakeSigner struct{}

func (fakeSigner) Sign(string, string, time.Time) (string, error) { return "signed-access", nil }
func (fakeSigner) Verify(string) (string, string, error)          { return "user", "family", nil }
func TestPrivateRestaurantRequiresOwner(t *testing.T) {
	repo := &fakeRepository{user: domain.User{Status: "ACTIVE"}, restaurant: domain.Restaurant{ID: "restaurant", UserID: "owner", Visibility: "PRIVATE"}}
	s := New(Dependencies{Database: fakeUnitOfWork{repo}})
	for _, actor := range []string{"", "other"} {
		if _, e := s.RestaurantDetail(context.Background(), actor, "restaurant"); !errors.Is(e, domain.ErrNotFound) {
			t.Fatalf("private restaurant exposed to %q: %v", actor, e)
		}
	}
	if e := s.DeleteRestaurant(context.Background(), "other", "restaurant"); !errors.Is(e, domain.ErrNotFound) || repo.saved || repo.committed {
		t.Fatal("non-owner changed restaurant")
	}
	if _, e := s.AttachImage(context.Background(), "other", "restaurant", AttachImageInput{MediaID: newID()}); !errors.Is(e, domain.ErrNotFound) || repo.mediaRead {
		t.Fatal("attachment ownership was not checked before media access")
	}
}
func TestOwnerCanSoftDelete(t *testing.T) {
	repo := &fakeRepository{restaurant: domain.Restaurant{ID: "restaurant", UserID: "owner", Visibility: "PRIVATE"}}
	s := New(Dependencies{Database: fakeUnitOfWork{repo}})
	if e := s.DeleteRestaurant(context.Background(), "owner", "restaurant"); e != nil {
		t.Fatal(e)
	}
	if !repo.committed || !repo.saved || repo.restaurant.DeletedAt == nil {
		t.Fatal("soft deletion was not committed")
	}
}
func TestRefreshReplayCommitsFamilyRevocation(t *testing.T) {
	now := time.Now()
	repo := &fakeRepository{user: domain.User{ID: "user", Status: "ACTIVE"}, session: domain.RefreshSession{ID: "session", UserID: "user", FamilyID: "family", RevokedAt: &now, ExpiresAt: now.Add(time.Hour)}}
	s := New(Dependencies{Database: fakeUnitOfWork{repo}})
	if _, e := s.Refresh(context.Background(), "old-token"); !errors.Is(e, domain.ErrUnauthorized) {
		t.Fatalf("expected rejection: %v", e)
	}
	if !repo.revoked || !repo.committed {
		t.Fatal("reuse revocation rolled back instead of committing")
	}
}
func TestRefreshRotatesAndDoesNotRevokeFamily(t *testing.T) {
	repo := &fakeRepository{user: domain.User{ID: "user", Status: "ACTIVE"}, session: domain.RefreshSession{ID: "session", UserID: "user", FamilyID: "family", ExpiresAt: time.Now().Add(time.Hour)}}
	s := New(Dependencies{Database: fakeUnitOfWork{repo}, Tokens: fakeSigner{}})
	result, e := s.Refresh(context.Background(), "valid-token")
	if e != nil {
		t.Fatal(e)
	}
	if !repo.committed || !repo.saved || repo.revoked || repo.session.RevokedAt == nil || repo.session.ReplacedByID == nil || result.RefreshToken == "" || result.AccessToken != "signed-access" {
		t.Fatal("rotation did not replace the session correctly")
	}
}
func TestRefreshInsertFailureDoesNotConsumeOldSession(t *testing.T) {
	failure := errors.New("database unavailable")
	repo := &fakeRepository{user: domain.User{ID: "user", Status: "ACTIVE"}, session: domain.RefreshSession{ID: "session", UserID: "user", ExpiresAt: time.Now().Add(time.Hour)}, insertErr: failure}
	s := New(Dependencies{Database: fakeUnitOfWork{repo}, Tokens: fakeSigner{}})
	if _, e := s.Refresh(context.Background(), "valid-token"); !errors.Is(e, failure) {
		t.Fatal(e)
	}
	if repo.saved || repo.committed {
		t.Fatal("failed rotation consumed existing session")
	}
}
