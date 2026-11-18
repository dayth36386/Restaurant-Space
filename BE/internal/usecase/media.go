package usecase

import (
	"bytes"
	"context"
	"errors"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

const MaxImageBytes = 8 << 20

func (s *Service) Upload(ctx context.Context, user string, raw []byte) (View, error) {
	if len(raw) > MaxImageBytes {
		return nil, bad("Image must be at most 8 MiB")
	}
	data, w, h, e := s.images.Normalize(raw)
	if e != nil {
		return nil, e
	}
	id := newID()
	m := domain.MediaObject{ID: id, OwnerID: user, Bucket: s.bucket, ObjectKey: "users/" + user + "/" + id + ".jpg", MimeType: "image/jpeg", SizeBytes: int64(len(data)), Width: w, Height: h, Status: "PENDING"}
	r := s.db.Repository(ctx)
	if e = r.CreateMedia(&m); e != nil {
		return nil, e
	}
	if e = s.storage.Put(ctx, m.ObjectKey, bytes.NewReader(data), int64(len(data)), m.MimeType); e != nil {
		return nil, e
	}
	m.Status = "READY"
	if e = r.SaveMedia(&m); e != nil {
		return nil, e
	}
	return s.uploadResult(ctx, m)
}
func (s *Service) uploadResult(ctx context.Context, m domain.MediaObject) (View, error) {
	url, e := s.storage.URL(ctx, m.ObjectKey)
	return View{"media": m, "url": url, "expires_in": 300}, e
}
func (s *Service) UploadDetail(ctx context.Context, user, id string) (View, error) {
	m, e := s.db.Repository(ctx).MediaObject(id, false)
	if e != nil {
		return nil, e
	}
	if m.OwnerID != user || m.Status != "READY" {
		return nil, domain.ErrNotFound
	}
	return s.uploadResult(ctx, m)
}
func (s *Service) mediaURL(ctx context.Context, id string) (string, error) {
	m, e := s.db.Repository(ctx).MediaObject(id, false)
	if e != nil {
		return "", e
	}
	if m.Status != "READY" {
		return "", domain.ErrNotFound
	}
	return s.storage.URL(ctx, m.ObjectKey)
}
func lockMedia(r port.Repository, id, user string) error {
	if !validID(id) {
		return bad("Invalid media UUID")
	}
	m, e := r.MediaObject(id, true)
	if e != nil {
		return e
	}
	if m.OwnerID != user || m.Status != "READY" {
		return domain.ErrNotFound
	}
	return nil
}

type AttachImageInput struct {
	MediaID   string  `json:"media_id"`
	AltText   *string `json:"alt_text"`
	SortOrder int     `json:"sort_order"`
	IsCover   bool    `json:"is_cover"`
}
type ImagePatchInput struct {
	AltText   *string `json:"alt_text"`
	SortOrder int     `json:"sort_order"`
	IsCover   bool    `json:"is_cover"`
}

func (s *Service) AttachImage(ctx context.Context, user, id string, in AttachImageInput) (im domain.RestaurantImage, e error) {
	if in.SortOrder < 0 || in.SortOrder > 10000 || !textLimit(in.AltText, 255) {
		return im, bad("Invalid image fields")
	}
	im = domain.RestaurantImage{ID: newID(), RestaurantID: id, MediaID: in.MediaID, AltText: in.AltText, SortOrder: in.SortOrder, IsCover: in.IsCover}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := owned(r, id, user); e != nil {
			return e
		}
		if e := lockMedia(r, in.MediaID, user); e != nil {
			return e
		}
		rows, e := r.Images(id)
		if e != nil {
			return e
		}
		if len(rows) >= 20 {
			return bad("Maximum 20 images per restaurant")
		}
		if in.IsCover {
			if e = r.ClearCover(id); e != nil {
				return e
			}
		}
		return r.CreateImage(&im)
	})
	return
}
func (s *Service) UpdateImage(ctx context.Context, user, id, imageID string, patch Patch) (im domain.RestaurantImage, e error) {
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := owned(r, id, user); e != nil {
			return e
		}
		var e error
		im, e = r.Image(imageID, id)
		if e != nil {
			return e
		}
		in := ImagePatchInput{im.AltText, im.SortOrder, im.IsCover}
		if e = mergePatch(&in, patch); e != nil {
			return e
		}
		if in.SortOrder < 0 || in.SortOrder > 10000 || !textLimit(in.AltText, 255) {
			return bad("Invalid image fields")
		}
		if in.IsCover {
			if e = r.ClearCover(id); e != nil {
				return e
			}
		}
		im.AltText = in.AltText
		im.SortOrder = in.SortOrder
		im.IsCover = in.IsCover
		return r.SaveImage(&im)
	})
	return
}
func (s *Service) DeleteImage(ctx context.Context, user, id, imageID string) error {
	return s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := owned(r, id, user); e != nil {
			return e
		}
		return r.DeleteImage(imageID, id)
	})
}
func (s *Service) Cleanup(ctx context.Context) error {
	candidates, e := s.db.Repository(ctx).CleanupCandidates(time.Now().UTC().Add(-24*time.Hour), 1000)
	if e != nil {
		return e
	}
	var failures []error
	for _, candidate := range candidates {
		m := candidate
		marked := false
		e = s.db.Transaction(ctx, func(r port.Repository) error {
			var e error
			m, e = r.MediaObject(m.ID, true)
			if e != nil {
				return e
			}
			referenced, e := r.MediaReferenced(m.ID)
			if e != nil {
				return e
			}
			if referenced {
				return nil
			}
			m.Status = "DELETING"
			if e = r.SaveMedia(&m); e != nil {
				return e
			}
			marked = true
			return nil
		})
		if errors.Is(e, domain.ErrNotFound) {
			continue
		}
		if e != nil {
			return e
		}
		if !marked {
			continue
		}
		if e = s.storage.Delete(ctx, m.ObjectKey); e != nil {
			failures = append(failures, e)
			continue
		}
		if e = s.db.Repository(ctx).DeleteMedia(m.ID); e != nil {
			return e
		}
	}
	if e = s.db.Repository(ctx).DeleteExpiredOAuthStates(time.Now().UTC()); e != nil {
		return e
	}
	return errors.Join(failures...)
}
