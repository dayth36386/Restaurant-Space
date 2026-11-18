package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

func (s *Service) profileImages(ctx context.Context, user string) (View, error) {
	out := View{"avatar_url": nil, "cover_url": nil}
	p, e := s.db.Repository(ctx).ProfileImages(user)
	if errors.Is(e, domain.ErrNotFound) {
		return out, nil
	}
	if e != nil {
		return nil, e
	}
	for key, id := range map[string]*string{"avatar_url": p.AvatarMediaID, "cover_url": p.CoverMediaID} {
		if id != nil {
			url, e := s.mediaURL(ctx, *id)
			if e != nil {
				return nil, e
			}
			out[key] = url
		}
	}
	return out, nil
}
func (s *Service) MyProfile(ctx context.Context, user string) (View, error) {
	u, e := s.db.Repository(ctx).User(user, false)
	if e != nil {
		return nil, e
	}
	images, e := s.profileImages(ctx, user)
	return View{"user": u, "images": images}, e
}
func (s *Service) PublicProfile(ctx context.Context, username string) (View, error) {
	u, e := s.db.Repository(ctx).UserByUsername(strings.ToLower(username))
	if e != nil {
		return nil, e
	}
	if !active(u) {
		return nil, domain.ErrNotFound
	}
	images, e := s.profileImages(ctx, u.ID)
	if e != nil {
		return nil, e
	}
	n, e := s.db.Repository(ctx).PublicRestaurantCount(u.ID)
	return View{"id": u.ID, "username": u.Username, "display_name": u.DisplayName, "bio": u.Bio, "images": images, "public_restaurant_count": n}, e
}

type ProfileInput struct {
	Username      string          `json:"username"`
	DisplayName   string          `json:"display_name"`
	Bio           *string         `json:"bio"`
	Preferences   json.RawMessage `json:"preferences"`
	AvatarMediaID *string         `json:"avatar_media_id"`
	CoverMediaID  *string         `json:"cover_media_id"`
}

func (s *Service) UpdateProfile(ctx context.Context, user string, patch Patch) (View, error) {
	e := s.db.Transaction(ctx, func(r port.Repository) error {
		u, e := r.User(user, true)
		if e != nil {
			return e
		}
		p, e := r.ProfileImages(user)
		if e != nil && !errors.Is(e, domain.ErrNotFound) {
			return e
		}
		p.UserID = user
		in := ProfileInput{u.Username, u.DisplayName, u.Bio, u.Preferences, p.AvatarMediaID, p.CoverMediaID}
		if e = mergePatch(&in, patch); e != nil {
			return e
		}
		in.Username = strings.ToLower(strings.TrimSpace(in.Username))
		in.DisplayName = strings.TrimSpace(in.DisplayName)
		if !usernamePattern.MatchString(in.Username) || len([]rune(in.DisplayName)) < 1 || len([]rune(in.DisplayName)) > 100 || !textLimit(in.Bio, 2000) || len(in.Preferences) > 4096 {
			return bad("Invalid profile fields")
		}
		if len(in.Preferences) > 0 && string(in.Preferences) != "null" {
			var obj map[string]any
			if json.Unmarshal(in.Preferences, &obj) != nil || obj == nil {
				return bad("preferences must be an object")
			}
		}
		ids := []string{}
		if in.AvatarMediaID != nil {
			ids = append(ids, *in.AvatarMediaID)
		}
		if in.CoverMediaID != nil {
			ids = append(ids, *in.CoverMediaID)
		}
		sort.Strings(ids)
		for _, id := range ids {
			if e = lockMedia(r, id, user); e != nil {
				return e
			}
		}
		u.Username = in.Username
		u.DisplayName = in.DisplayName
		u.Bio = in.Bio
		u.Preferences = in.Preferences
		if e = r.SaveUser(&u); e != nil {
			return e
		}
		p.AvatarMediaID = in.AvatarMediaID
		p.CoverMediaID = in.CoverMediaID
		return r.SaveProfileImages(&p)
	})
	if e != nil {
		return nil, e
	}
	return s.MyProfile(ctx, user)
}
