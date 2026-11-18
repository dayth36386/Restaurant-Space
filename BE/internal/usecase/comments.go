package usecase

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

const maxCommentLength = 2000

type CommentInput struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parent_id"`
}

// users resolves public author summaries once per request.
type users struct {
	s     *Service
	ctx   context.Context
	cache map[string]View
}

func (s *Service) users(ctx context.Context) *users {
	return &users{s: s, ctx: ctx, cache: map[string]View{}}
}
func (u *users) get(id string) (View, error) {
	if v, ok := u.cache[id]; ok {
		return v, nil
	}
	user, e := u.s.db.Repository(u.ctx).User(id, false)
	if e != nil {
		return nil, e
	}
	images, e := u.s.profileImages(u.ctx, id)
	if e != nil {
		return nil, e
	}
	v := View{"id": user.ID, "username": user.Username, "display_name": user.DisplayName, "avatar_url": images["avatar_url"]}
	u.cache[id] = v
	return v, nil
}

func encodeCursor(t time.Time, id string) string {
	b, _ := json.Marshal(cursor{t, id})
	return base64.RawURLEncoding.EncodeToString(b)
}

func cleanContent(raw string, max int) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" || len([]rune(v)) > max {
		return "", bad("content must be 1-" + strconv.Itoa(max) + " characters")
	}
	return v, nil
}

func (s *Service) commentView(c domain.Comment, people *users) (View, error) {
	deleted := c.DeletedAt != nil
	out := View{"id": c.ID, "restaurant_id": c.RestaurantID, "parent_id": c.ParentID, "content": c.Content, "deleted": deleted, "edited": c.UpdatedAt.After(c.CreatedAt), "created_at": c.CreatedAt, "updated_at": c.UpdatedAt, "author": nil}
	if deleted {
		// Keep the thread shape but drop what was removed.
		out["content"] = nil
		return out, nil
	}
	author, e := people.get(c.UserID)
	if e != nil {
		return nil, e
	}
	out["author"] = author
	return out, nil
}

// ListComments pages top-level comments (newest first) with their replies attached.
func (s *Service) ListComments(ctx context.Context, user, restaurant string, limit int, raw string) (View, error) {
	if _, e := s.visible(ctx, restaurant, user); e != nil {
		return nil, e
	}
	limit, cur, e := page(limit, raw)
	if e != nil {
		return nil, e
	}
	r := s.db.Repository(ctx)
	f := port.CommentFilter{RestaurantID: restaurant, Limit: limit + 1}
	if cur != nil {
		f.BeforeTime, f.BeforeID = cur.Time, cur.ID
	}
	rows, e := r.ListComments(f)
	if e != nil {
		return nil, e
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		next = encodeCursor(last.CreatedAt, last.ID)
	}
	ids := make([]string, 0, len(rows))
	for _, c := range rows {
		ids = append(ids, c.ID)
	}
	replies, e := r.Replies(restaurant, ids)
	if e != nil {
		return nil, e
	}
	people := s.users(ctx)
	byParent := map[string][]View{}
	for _, c := range replies {
		v, e := s.commentView(c, people)
		if e != nil {
			return nil, e
		}
		byParent[*c.ParentID] = append(byParent[*c.ParentID], v)
	}
	items := make([]View, 0, len(rows))
	for _, c := range rows {
		v, e := s.commentView(c, people)
		if e != nil {
			return nil, e
		}
		v["replies"] = append([]View{}, byParent[c.ID]...)
		items = append(items, v)
	}
	return View{"items": items, "next_cursor": next}, nil
}

// CreateComment comments on a public restaurant. Replies stay one level deep:
// replying to a reply attaches to that reply's top-level parent.
func (s *Service) CreateComment(ctx context.Context, user, restaurant string, in CommentInput) (View, error) {
	content, e := cleanContent(in.Content, maxCommentLength)
	if e != nil {
		return nil, e
	}
	v, e := s.visible(ctx, restaurant, user)
	if e != nil {
		return nil, e
	}
	if v.Visibility != "PUBLIC" {
		return nil, bad("Comments are only allowed on public restaurants")
	}
	c := domain.Comment{ID: newID(), RestaurantID: restaurant, UserID: user, Content: content}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if in.ParentID != nil {
			if !validID(*in.ParentID) {
				return bad("Invalid parent_id")
			}
			parent, e := r.Comment(*in.ParentID, false)
			if e != nil || parent.RestaurantID != restaurant || parent.DeletedAt != nil {
				return bad("Parent comment not found")
			}
			top := parent.ID
			if parent.ParentID != nil {
				top = *parent.ParentID
			}
			c.ParentID = &top
		}
		return r.CreateComment(&c)
	})
	if e != nil {
		return nil, e
	}
	saved, e := s.db.Repository(ctx).Comment(c.ID, false)
	if e != nil {
		return nil, e
	}
	out, e := s.commentView(saved, s.users(ctx))
	if e == nil && saved.ParentID == nil {
		out["replies"] = []View{}
	}
	return out, e
}

func ownComment(r port.Repository, id, user string) (domain.Comment, error) {
	c, e := r.Comment(id, true)
	if e != nil {
		return c, e
	}
	if c.UserID != user || c.DeletedAt != nil {
		return c, domain.ErrNotFound
	}
	return c, nil
}

func (s *Service) UpdateComment(ctx context.Context, user, id string, in CommentInput) (View, error) {
	if in.ParentID != nil {
		return nil, bad("parent_id cannot be changed")
	}
	content, e := cleanContent(in.Content, maxCommentLength)
	if e != nil {
		return nil, e
	}
	var c domain.Comment
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if c, e = ownComment(r, id, user); e != nil {
			return e
		}
		c.Content = content
		c.UpdatedAt = time.Now().UTC()
		return r.SaveComment(&c)
	})
	if e != nil {
		return nil, e
	}
	return s.commentView(c, s.users(ctx))
}

func (s *Service) DeleteComment(ctx context.Context, user, id string) error {
	return s.db.Transaction(ctx, func(r port.Repository) error {
		c, e := ownComment(r, id, user)
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		c.DeletedAt = &now
		return r.SaveComment(&c)
	})
}

// SetLike is idempotent and returns the resulting state.
func (s *Service) SetLike(ctx context.Context, user, restaurant string, liked bool) (View, error) {
	if _, e := s.visible(ctx, restaurant, user); e != nil {
		return nil, e
	}
	r := s.db.Repository(ctx)
	if e := r.SetLike(user, restaurant, liked); e != nil {
		return nil, e
	}
	likes, _, e := r.SocialCounts(restaurant)
	if e != nil {
		return nil, e
	}
	return View{"liked": liked, "like_count": likes}, nil
}
