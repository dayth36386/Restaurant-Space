package usecase

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

type View map[string]any

func owned(r port.Repository, id, user string) (domain.Restaurant, error) {
	v, e := r.Restaurant(id, true)
	if e != nil {
		return v, e
	}
	if v.UserID != user || v.DeletedAt != nil {
		return v, domain.ErrNotFound
	}
	return v, nil
}
func (s *Service) visible(ctx context.Context, id, user string) (domain.Restaurant, error) {
	r := s.db.Repository(ctx)
	v, e := r.Restaurant(id, false)
	if e != nil {
		return v, e
	}
	if v.DeletedAt != nil || (v.Visibility != "PUBLIC" && v.UserID != user) {
		return v, domain.ErrNotFound
	}
	owner, e := r.User(v.UserID, false)
	if e != nil {
		return v, e
	}
	if !active(owner) {
		return v, domain.ErrNotFound
	}
	return v, nil
}
func (s *Service) CreateRestaurant(ctx context.Context, user string, in RestaurantInput) (v domain.Restaurant, e error) {
	if e = in.validate(); e != nil {
		return
	}
	v = in.model()
	v.ID = newID()
	v.UserID = user
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if e := r.CreateRestaurant(&v); e != nil {
			return e
		}
		return r.SetTaxonomy(v.ID, in.CategoryIDs, in.TagIDs)
	})
	return
}
func (s *Service) UpdateRestaurant(ctx context.Context, user, id string, patch Patch) (v domain.Restaurant, e error) {
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		old, e := owned(r, id, user)
		if e != nil {
			return e
		}
		b, _ := json.Marshal(old)
		var in RestaurantInput
		_ = json.Unmarshal(b, &in)
		cats, tags, e := r.RestaurantTaxonomy(id)
		if e != nil {
			return e
		}
		for _, c := range cats {
			in.CategoryIDs = append(in.CategoryIDs, c.ID)
		}
		for _, t := range tags {
			in.TagIDs = append(in.TagIDs, t.ID)
		}
		if e = mergePatch(&in, patch); e != nil {
			return e
		}
		if e = in.validate(); e != nil {
			return e
		}
		v = in.model()
		v.ID = id
		v.UserID = user
		v.CreatedAt = old.CreatedAt
		if e = r.SaveRestaurant(&v); e != nil {
			return e
		}
		return r.SetTaxonomy(id, in.CategoryIDs, in.TagIDs)
	})
	return
}
func (s *Service) DeleteRestaurant(ctx context.Context, user, id string) error {
	return s.db.Transaction(ctx, func(r port.Repository) error {
		v, e := owned(r, id, user)
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		v.DeletedAt = &now
		return r.SaveRestaurant(&v)
	})
}

type ListInput struct {
	Limit                                           int
	Cursor, Query, OwnerID, VisitStatus, CategoryID string
	Mine, PublicOnly                                bool
}
type cursor struct {
	Time time.Time `json:"time"`
	ID   string    `json:"id"`
}

func page(limit int, raw string) (int, *cursor, error) {
	if limit == 0 {
		limit = 20
	}
	if limit < 1 || limit > 100 {
		return 0, nil, bad("limit must be 1-100")
	}
	var cur *cursor
	if raw != "" {
		if len(raw) > 512 {
			return 0, nil, bad("Invalid cursor")
		}
		b, e := base64.RawURLEncoding.DecodeString(raw)
		if e != nil {
			return 0, nil, bad("Invalid cursor")
		}
		cur = &cursor{}
		if e = json.Unmarshal(b, cur); e != nil || !validID(cur.ID) || cur.Time.IsZero() {
			return 0, nil, bad("Invalid cursor")
		}
	}
	return limit, cur, nil
}
func (s *Service) ListRestaurants(ctx context.Context, user string, in ListInput) (View, error) {
	limit, cur, e := page(in.Limit, in.Cursor)
	if e != nil {
		return nil, e
	}
	if in.Mine && user == "" {
		return nil, domain.ErrUnauthorized
	}
	if (in.OwnerID != "" && !validID(in.OwnerID)) || (in.CategoryID != "" && !validID(in.CategoryID)) {
		return nil, bad("Invalid filter UUID")
	}
	if in.VisitStatus != "" && in.VisitStatus != "VISITED" && in.VisitStatus != "WANT_TO_GO" {
		return nil, bad("Invalid visit_status")
	}
	in.Query = strings.TrimSpace(in.Query)
	if len([]rune(in.Query)) > 100 {
		return nil, bad("Search too long")
	}
	owner := in.OwnerID
	if in.Mine {
		if owner != "" && owner != user {
			return View{"items": []View{}, "next_cursor": ""}, nil
		}
		owner = user
	}
	f := port.RestaurantFilter{ViewerID: user, OwnerID: owner, Query: in.Query, VisitStatus: in.VisitStatus, CategoryID: in.CategoryID, PublicOnly: in.PublicOnly, Limit: limit + 1}
	if cur != nil {
		f.BeforeTime = cur.Time
		f.BeforeID = cur.ID
	}
	rows, e := s.db.Repository(ctx).ListRestaurants(f)
	if e != nil {
		return nil, e
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		b, _ := json.Marshal(cursor{last.CreatedAt, last.ID})
		next = base64.RawURLEncoding.EncodeToString(b)
	}
	items := make([]View, 0, len(rows))
	people := s.users(ctx)
	for _, row := range rows {
		card, e := s.restaurantCard(ctx, row, people)
		if e != nil {
			return nil, e
		}
		items = append(items, card)
	}
	return View{"items": items, "next_cursor": next}, nil
}

// restaurantCard is a restaurant post as listed: the restaurant, its cover, counters
// and the public profile of the user who recommended it.
func (s *Service) restaurantCard(ctx context.Context, v domain.Restaurant, people *users) (View, error) {
	r := s.db.Repository(ctx)
	author, e := people.get(v.UserID)
	if e != nil {
		return nil, e
	}
	out := View{"restaurant": v, "cover_url": nil, "author": author}
	images, e := r.Images(v.ID)
	if e != nil {
		return nil, e
	}
	if len(images) > 0 {
		cover := images[0]
		for _, im := range images {
			if im.IsCover {
				cover = im
				break
			}
		}
		url, e := s.mediaURL(ctx, cover.MediaID)
		if e != nil {
			return nil, e
		}
		out["cover_url"] = url
	}
	likes, comments, e := r.SocialCounts(v.ID)
	if e != nil {
		return nil, e
	}
	out["like_count"] = likes
	out["comment_count"] = comments
	return out, nil
}
func (s *Service) RestaurantDetail(ctx context.Context, user, id string) (View, error) {
	v, e := s.visible(ctx, id, user)
	if e != nil {
		return nil, e
	}
	out, e := s.restaurantCard(ctx, v, s.users(ctx))
	if e != nil {
		return nil, e
	}
	r := s.db.Repository(ctx)
	imgs, e := r.Images(id)
	if e != nil {
		return nil, e
	}
	images := make([]View, 0, len(imgs))
	for _, im := range imgs {
		url, e := s.mediaURL(ctx, im.MediaID)
		if e != nil {
			return nil, e
		}
		images = append(images, View{"image": im, "url": url})
	}
	menus, e := r.Menus(id)
	if e != nil {
		return nil, e
	}
	items := make([]View, 0, len(menus))
	for _, m := range menus {
		url := ""
		if m.ImageMediaID != nil {
			url, e = s.mediaURL(ctx, *m.ImageMediaID)
			if e != nil {
				return nil, e
			}
		}
		items = append(items, View{"menu": m, "image_url": url})
	}
	cats, tags, e := r.RestaurantTaxonomy(id)
	if e != nil {
		return nil, e
	}
	liked := false
	if user != "" {
		if liked, e = r.Liked(user, id); e != nil {
			return nil, e
		}
	}
	out["liked"] = liked
	out["images"] = images
	out["menus"] = items
	out["categories"] = cats
	out["tags"] = tags
	return out, nil
}
func (s *Service) Categories(ctx context.Context) (View, error) {
	v, e := s.db.Repository(ctx).Categories()
	return View{"items": v}, e
}
func (s *Service) Tags(ctx context.Context) (View, error) {
	v, e := s.db.Repository(ctx).Tags()
	return View{"items": v}, e
}
