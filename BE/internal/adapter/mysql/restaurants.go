package mysql

import (
	"strings"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

func (r *repository) Restaurant(id string, lock bool) (v domain.Restaurant, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) ListRestaurants(f port.RestaurantFilter) (rows []domain.Restaurant, e error) {
	q := r.db.Model(&domain.Restaurant{}).Where("restaurants.deleted_at IS NULL").Where("EXISTS (SELECT 1 FROM users owner WHERE owner.id = restaurants.user_id AND owner.deleted_at IS NULL AND owner.status = 'ACTIVE')").Where("visibility = 'PUBLIC' OR user_id = ?", f.ViewerID)
	if f.PublicOnly {
		q = q.Where("visibility = 'PUBLIC'")
	}
	if f.OwnerID != "" {
		q = q.Where("user_id = ?", f.OwnerID)
	}
	if f.VisitStatus != "" {
		q = q.Where("visit_status = ?", f.VisitStatus)
	}
	if f.CategoryID != "" {
		q = q.Where("EXISTS (SELECT 1 FROM restaurant_categories rc WHERE rc.restaurant_id = restaurants.id AND rc.category_id = ?)", f.CategoryID)
	}
	if f.Query != "" {
		escaped := strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(f.Query)
		q = q.Where("(name LIKE ? ESCAPE '!' OR address LIKE ? ESCAPE '!')", "%"+escaped+"%", "%"+escaped+"%")
	}
	if f.BeforeID != "" {
		q = q.Where("created_at < ? OR (created_at = ? AND id < ?)", f.BeforeTime, f.BeforeTime, f.BeforeID)
	}
	e = translate(q.Order("created_at DESC, id DESC").Limit(f.Limit).Find(&rows).Error)
	return
}
func (r *repository) SetTaxonomy(id string, categories, tags []string) error {
	for _, item := range []struct {
		table, join, col string
		ids              []string
	}{{"categories", "restaurant_categories", "category_id", categories}, {"tags", "restaurant_tags", "tag_id", tags}} {
		var n int64
		if len(item.ids) > 0 {
			if e := r.db.Table(item.table).Where("id IN ?", item.ids).Count(&n).Error; e != nil {
				return translate(e)
			}
			if n != int64(len(item.ids)) {
				return domain.Invalid("Unknown category or tag")
			}
		}
		if e := r.db.Exec("DELETE FROM "+item.join+" WHERE restaurant_id = ?", id).Error; e != nil {
			return translate(e)
		}
		for _, target := range item.ids {
			if e := r.db.Exec("INSERT INTO "+item.join+" (restaurant_id,"+item.col+") VALUES (?,?)", id, target).Error; e != nil {
				return translate(e)
			}
		}
	}
	return nil
}
func (r *repository) RestaurantTaxonomy(id string) (cats []domain.Category, tags []domain.Tag, e error) {
	if e = translate(r.db.Table("categories").Joins("JOIN restaurant_categories rc ON rc.category_id=categories.id").Where("rc.restaurant_id = ?", id).Find(&cats).Error); e != nil {
		return
	}
	e = translate(r.db.Table("tags").Joins("JOIN restaurant_tags rt ON rt.tag_id=tags.id").Where("rt.restaurant_id = ?", id).Find(&tags).Error)
	return
}
func (r *repository) Categories() (v []domain.Category, e error) {
	e = translate(r.db.Order("name").Find(&v).Error)
	return
}
func (r *repository) Tags() (v []domain.Tag, e error) {
	e = translate(r.db.Order("name").Find(&v).Error)
	return
}
func (r *repository) PublicRestaurantCount(user string) (n int64, e error) {
	e = translate(r.db.Model(&domain.Restaurant{}).Where("user_id = ? AND visibility = 'PUBLIC' AND deleted_at IS NULL", user).Count(&n).Error)
	return
}
func (r *repository) SocialCounts(id string) (likes, comments int64, e error) {
	if e = translate(r.db.Table("restaurant_likes").Where("restaurant_id = ?", id).Count(&likes).Error); e != nil {
		return
	}
	e = translate(r.db.Table("comments").Where("restaurant_id = ? AND deleted_at IS NULL", id).Count(&comments).Error)
	return
}
func (r *repository) CreateRestaurant(v *domain.Restaurant) error {
	return translate(r.db.Create(v).Error)
}
func (r *repository) SaveRestaurant(v *domain.Restaurant) error { return translate(r.db.Save(v).Error) }
