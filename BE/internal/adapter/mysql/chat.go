package mysql

import (
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

func (r *repository) Conversation(id string) (v domain.Conversation, e error) {
	e = translate(r.db.First(&v, "id = ?", id).Error)
	return
}
func (r *repository) ConversationByPair(low, high string) (v domain.Conversation, e error) {
	e = translate(r.db.First(&v, "user_low_id = ? AND user_high_id = ?", low, high).Error)
	return
}
func (r *repository) CreateConversation(c *domain.Conversation, members []domain.ConversationMember) error {
	if e := r.db.Create(c).Error; e != nil {
		return translate(e)
	}
	for _, m := range members {
		// joined_at and the read cursor use column defaults.
		if e := r.db.Exec("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)", m.ConversationID, m.UserID).Error; e != nil {
			return translate(e)
		}
	}
	return nil
}
func (r *repository) Conversations(user string, limit int) (rows []domain.Conversation, e error) {
	e = translate(r.db.Joins("JOIN conversation_members m ON m.conversation_id = conversations.id AND m.user_id = ?", user).
		Order("conversations.updated_at DESC, conversations.id DESC").Limit(limit).Find(&rows).Error)
	return
}
func (r *repository) Members(conversation string) (rows []domain.ConversationMember, e error) {
	e = translate(r.db.Where("conversation_id = ?", conversation).Order("user_id").Find(&rows).Error)
	return
}
func (r *repository) Member(conversation, user string, lock bool) (v domain.ConversationMember, e error) {
	e = translate(r.query(lock).Where("conversation_id = ? AND user_id = ?", conversation, user).First(&v).Error)
	return
}

// SaveMember updates by the composite key; GORM's Save assumes an ID column.
func (r *repository) SaveMember(v *domain.ConversationMember) error {
	return translate(r.db.Exec("UPDATE conversation_members SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?", v.LastReadMessageID, v.ConversationID, v.UserID).Error)
}
func (r *repository) ConversationPartners(user string) (ids []string, e error) {
	e = translate(r.db.Raw("SELECT DISTINCT other.user_id FROM conversation_members mine JOIN conversation_members other ON other.conversation_id = mine.conversation_id AND other.user_id <> mine.user_id WHERE mine.user_id = ?", user).Scan(&ids).Error)
	return
}
func (r *repository) Messages(f port.MessageFilter) (rows []domain.Message, e error) {
	q := r.db.Where("conversation_id = ? AND deleted_at IS NULL", f.ConversationID)
	if f.BeforeID != "" {
		q = q.Where("created_at < ? OR (created_at = ? AND id < ?)", f.BeforeTime, f.BeforeTime, f.BeforeID)
	}
	e = translate(q.Order("created_at DESC, id DESC").Limit(f.Limit).Find(&rows).Error)
	return
}
func (r *repository) Message(conversation, id string) (v domain.Message, e error) {
	e = translate(r.db.First(&v, "conversation_id = ? AND id = ?", conversation, id).Error)
	return
}
func (r *repository) MessageByClientID(conversation, sender, clientID string) (v domain.Message, e error) {
	e = translate(r.db.First(&v, "conversation_id = ? AND sender_id = ? AND client_message_id = ?", conversation, sender, clientID).Error)
	return
}
func (r *repository) LastMessage(conversation string) (v domain.Message, e error) {
	e = translate(r.db.Where("conversation_id = ? AND deleted_at IS NULL", conversation).Order("created_at DESC, id DESC").First(&v).Error)
	return
}
func (r *repository) CreateMessage(v *domain.Message) error { return translate(r.db.Create(v).Error) }
func (r *repository) TouchConversation(id string, at time.Time) error {
	return translate(r.db.Exec("UPDATE conversations SET updated_at = ? WHERE id = ?", at, id).Error)
}
func (r *repository) UnreadCount(conversation, user string) (n int64, e error) {
	e = translate(r.db.Raw(`SELECT COUNT(*) FROM messages msg
		JOIN conversation_members me ON me.conversation_id = msg.conversation_id AND me.user_id = ?
		LEFT JOIN messages seen ON seen.id = me.last_read_message_id
		WHERE msg.conversation_id = ? AND msg.sender_id <> ? AND msg.deleted_at IS NULL
		AND (seen.id IS NULL OR msg.created_at > seen.created_at OR (msg.created_at = seen.created_at AND msg.id > seen.id))`, user, conversation, user).Scan(&n).Error)
	return
}
