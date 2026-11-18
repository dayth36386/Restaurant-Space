package mysql

import (
	"time"

	"gorm.io/gorm/clause"

	"restaurant-space/api/internal/domain"
)

func (r *repository) User(id string, lock bool) (v domain.User, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) UserByEmail(email string) (v domain.User, e error) {
	e = translate(r.db.First(&v, "email = ?", email).Error)
	return
}
func (r *repository) UserByUsername(name string) (v domain.User, e error) {
	e = translate(r.db.First(&v, "username = ?", name).Error)
	return
}
func (r *repository) SessionByHash(hash []byte) (v domain.RefreshSession, e error) {
	e = translate(r.db.First(&v, "token_hash = ?", hash).Error)
	return
}
func (r *repository) Session(id string, lock bool) (v domain.RefreshSession, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) ActiveFamily(user, family string, now time.Time) (bool, error) {
	var n int64
	e := r.db.Table("refresh_sessions rs").Joins("JOIN users u ON u.id = rs.user_id").Where("rs.user_id = ? AND rs.family_id = ? AND rs.revoked_at IS NULL AND rs.expires_at > ? AND u.status = 'ACTIVE' AND u.deleted_at IS NULL", user, family, now).Count(&n).Error
	return n > 0, translate(e)
}
func (r *repository) RevokeFamily(id string, now time.Time) error {
	return translate(r.db.Model(&domain.RefreshSession{}).Where("family_id = ? AND revoked_at IS NULL", id).Update("revoked_at", now).Error)
}
func (r *repository) RevokeUserSessions(id string, now time.Time) error {
	return translate(r.db.Model(&domain.RefreshSession{}).Where("user_id = ? AND revoked_at IS NULL", id).Update("revoked_at", now).Error)
}
func (r *repository) ResetByHash(hash []byte) (v domain.PasswordResetToken, e error) {
	e = translate(r.db.First(&v, "token_hash = ?", hash).Error)
	return
}
func (r *repository) ResetToken(id string, lock bool) (v domain.PasswordResetToken, e error) {
	e = translate(r.query(lock).First(&v, "id = ?", id).Error)
	return
}
func (r *repository) ConsumeResets(user string, now time.Time) error {
	return translate(r.db.Model(&domain.PasswordResetToken{}).Where("user_id = ? AND used_at IS NULL", user).Update("used_at", now).Error)
}
func (r *repository) ConsumeOAuthState(hash []byte, now time.Time) (v domain.OauthState, e error) {
	if e = translate(r.query(true).Where("state_hash = ? AND expires_at > ?", hash, now).First(&v).Error); e != nil {
		return
	}
	e = translate(r.db.Delete(&v).Error)
	return
}
func (r *repository) OAuthAccount(subject string) (v domain.OauthAccount, e error) {
	e = translate(r.db.Where("provider = 'google' AND provider_user_id = ?", subject).First(&v).Error)
	return
}
func (r *repository) ProfileImages(user string) (v domain.UserProfileImage, e error) {
	e = translate(r.db.First(&v, "user_id = ?", user).Error)
	return
}
func (r *repository) SaveProfileImages(v *domain.UserProfileImage) error {
	return translate(r.db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"avatar_media_id", "cover_media_id"})}).Create(v).Error)
}
func (r *repository) DeleteExpiredOAuthStates(now time.Time) error {
	return translate(r.db.Where("expires_at < ?", now).Delete(&domain.OauthState{}).Error)
}
func (r *repository) CreateUser(v *domain.User) error { return translate(r.db.Create(v).Error) }
func (r *repository) SaveUser(v *domain.User) error   { return translate(r.db.Save(v).Error) }

func (r *repository) CreateSession(v *domain.RefreshSession) error {
	return translate(r.db.Create(v).Error)
}
func (r *repository) SaveSession(v *domain.RefreshSession) error {
	return translate(r.db.Save(v).Error)
}

func (r *repository) CreateReset(v *domain.PasswordResetToken) error {
	return translate(r.db.Create(v).Error)
}

func (r *repository) CreateOAuthState(v *domain.OauthState) error {
	return translate(r.db.Create(v).Error)
}

func (r *repository) CreateOAuthAccount(v *domain.OauthAccount) error {
	return translate(r.db.Create(v).Error)
}
