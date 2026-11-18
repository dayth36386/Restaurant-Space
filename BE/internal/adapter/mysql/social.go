package mysql

import (
	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

func (r *repository) Comment(id string, lock bool) (v domain.Comment, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) ListComments(f port.CommentFilter) (rows []domain.Comment, e error) {
	q := r.db.Where("restaurant_id = ? AND parent_id IS NULL", f.RestaurantID).
		Where("deleted_at IS NULL OR EXISTS (SELECT 1 FROM comments reply WHERE reply.parent_id = comments.id AND reply.deleted_at IS NULL)")
	if f.BeforeID != "" {
		q = q.Where("created_at < ? OR (created_at = ? AND id < ?)", f.BeforeTime, f.BeforeTime, f.BeforeID)
	}
	e = translate(q.Order("created_at DESC, id DESC").Limit(f.Limit).Find(&rows).Error)
	return
}
func (r *repository) Replies(restaurant string, parents []string) (rows []domain.Comment, e error) {
	if len(parents) == 0 {
		return nil, nil
	}
	e = translate(r.db.Where("restaurant_id = ? AND parent_id IN ? AND deleted_at IS NULL", restaurant, parents).Order("created_at, id").Find(&rows).Error)
	return
}
func (r *repository) CreateComment(v *domain.Comment) error { return translate(r.db.Create(v).Error) }
func (r *repository) SaveComment(v *domain.Comment) error   { return translate(r.db.Save(v).Error) }
func (r *repository) SetLike(user, restaurant string, liked bool) error {
	if liked {
		return translate(r.db.Exec("INSERT IGNORE INTO restaurant_likes (user_id, restaurant_id) VALUES (?, ?)", user, restaurant).Error)
	}
	return translate(r.db.Exec("DELETE FROM restaurant_likes WHERE user_id = ? AND restaurant_id = ?", user, restaurant).Error)
}
func (r *repository) Liked(user, restaurant string) (bool, error) {
	var n int64
	e := translate(r.db.Table("restaurant_likes").Where("user_id = ? AND restaurant_id = ?", user, restaurant).Count(&n).Error)
	return n > 0, e
}
