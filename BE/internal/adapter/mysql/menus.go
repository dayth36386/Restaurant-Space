package mysql

import (
	"restaurant-space/api/internal/domain"
)

func (r *repository) Menus(id string) (v []domain.RestaurantMenu, e error) {
	e = translate(r.db.Where("restaurant_id = ?", id).Order("sort_order,id").Find(&v).Error)
	return
}
func (r *repository) Menu(id, restaurant string) (v domain.RestaurantMenu, e error) {
	e = translate(r.db.Where("id = ? AND restaurant_id = ?", id, restaurant).First(&v).Error)
	return
}
func (r *repository) CreateMenu(v *domain.RestaurantMenu) error {
	return translate(r.db.Create(v).Error)
}
func (r *repository) SaveMenu(v *domain.RestaurantMenu) error { return translate(r.db.Save(v).Error) }

func (r *repository) DeleteMenu(id, restaurant string) error {
	res := r.db.Where("id = ? AND restaurant_id = ?", id, restaurant).Delete(&domain.RestaurantMenu{})
	if res.Error != nil {
		return translate(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
