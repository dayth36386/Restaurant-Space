package usecase

import (
	"context"
	"strings"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

type MenuInput struct {
	Name         string   `json:"name"`
	Description  *string  `json:"description"`
	Price        *float64 `json:"price"`
	ImageMediaID *string  `json:"image_media_id"`
	SortOrder    int      `json:"sort_order"`
}

func (in *MenuInput) validate() error {
	in.Name = strings.TrimSpace(in.Name)
	if len([]rune(in.Name)) < 1 || len([]rune(in.Name)) > 200 || !textLimit(in.Description, 10000) || !money(in.Price) || in.SortOrder < 0 || in.SortOrder > 10000 {
		return bad("Invalid menu fields")
	}
	return nil
}
func (s *Service) SaveMenu(ctx context.Context, user, id, menuID string, patch Patch) (m domain.RestaurantMenu, e error) {
	create := menuID == ""
	if create {
		menuID = newID()
	}
	m = domain.RestaurantMenu{ID: menuID, RestaurantID: id}
	e = s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := owned(r, id, user); e != nil {
			return e
		}
		if !create {
			var e error
			m, e = r.Menu(menuID, id)
			if e != nil {
				return e
			}
		} else {
			rows, e := r.Menus(id)
			if e != nil {
				return e
			}
			if len(rows) >= 200 {
				return bad("Maximum 200 menus per restaurant")
			}
		}
		in := MenuInput{m.Name, m.Description, m.Price, m.ImageMediaID, m.SortOrder}
		if e := mergePatch(&in, patch); e != nil {
			return e
		}
		if e := in.validate(); e != nil {
			return e
		}
		if in.ImageMediaID != nil {
			if e := lockMedia(r, *in.ImageMediaID, user); e != nil {
				return e
			}
		}
		m.Name = in.Name
		m.Description = in.Description
		m.Price = in.Price
		m.ImageMediaID = in.ImageMediaID
		m.SortOrder = in.SortOrder
		if create {
			return r.CreateMenu(&m)
		}
		return r.SaveMenu(&m)
	})
	return
}
func (s *Service) DeleteMenu(ctx context.Context, user, id, menuID string) error {
	return s.db.Transaction(ctx, func(r port.Repository) error {
		if _, e := owned(r, id, user); e != nil {
			return e
		}
		return r.DeleteMenu(menuID, id)
	})
}
