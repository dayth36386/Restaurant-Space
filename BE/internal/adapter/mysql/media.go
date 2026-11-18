package mysql

import (
	"time"

	"restaurant-space/api/internal/domain"
)

func (r *repository) Images(id string) (v []domain.RestaurantImage, e error) {
	e = translate(r.db.Where("restaurant_id = ?", id).Order("sort_order,id").Find(&v).Error)
	return
}
func (r *repository) Image(id, restaurant string) (v domain.RestaurantImage, e error) {
	e = translate(r.db.Where("id = ? AND restaurant_id = ?", id, restaurant).First(&v).Error)
	return
}
func (r *repository) ClearCover(id string) error {
	return translate(r.db.Model(&domain.RestaurantImage{}).Where("restaurant_id = ? AND is_cover = TRUE", id).Update("is_cover", false).Error)
}
func (r *repository) MediaObject(id string, lock bool) (v domain.MediaObject, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) CleanupCandidates(before time.Time, limit int) (v []domain.MediaObject, e error) {
	e = translate(r.db.Where("(created_at < ? OR status = 'DELETING') AND NOT EXISTS (SELECT 1 FROM restaurant_images ri WHERE ri.media_id = media_objects.id) AND NOT EXISTS (SELECT 1 FROM restaurant_menus rm WHERE rm.image_media_id = media_objects.id) AND NOT EXISTS (SELECT 1 FROM user_profile_images up WHERE up.avatar_media_id = media_objects.id OR up.cover_media_id = media_objects.id)", before).Order("created_at").Limit(limit).Find(&v).Error)
	return
}
func (r *repository) MediaReferenced(id string) (bool, error) {
	for _, item := range []struct{ table, where string }{{"restaurant_images", "media_id = ?"}, {"restaurant_menus", "image_media_id = ?"}, {"user_profile_images", "avatar_media_id = ? OR cover_media_id = ?"}} {
		args := []any{id}
		if item.table == "user_profile_images" {
			args = append(args, id)
		}
		var n int64
		if e := r.db.Table(item.table).Where(item.where, args...).Count(&n).Error; e != nil {
			return false, translate(e)
		}
		if n > 0 {
			return true, nil
		}
	}
	return false, nil
}
func (r *repository) DeleteMedia(id string) error {
	return translate(r.db.Where("id = ? AND status = 'DELETING'", id).Delete(&domain.MediaObject{}).Error)
}

func (r *repository) CreateImage(v *domain.RestaurantImage) error {
	return translate(r.db.Create(v).Error)
}
func (r *repository) SaveImage(v *domain.RestaurantImage) error { return translate(r.db.Save(v).Error) }

func (r *repository) CreateMedia(v *domain.MediaObject) error { return translate(r.db.Create(v).Error) }
func (r *repository) SaveMedia(v *domain.MediaObject) error   { return translate(r.db.Save(v).Error) }
func (r *repository) DeleteImage(id, restaurant string) error {
	res := r.db.Where("id = ? AND restaurant_id = ?", id, restaurant).Delete(&domain.RestaurantImage{})
	if res.Error != nil {
		return translate(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}
