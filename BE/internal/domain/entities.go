package domain

import (
	"encoding/json"
	"time"
)

type User struct {
	ID              string          `json:"id"`
	Email           string          `json:"email"`
	Username        string          `json:"username"`
	PasswordHash    *string         `json:"-"`
	DisplayName     string          `json:"display_name"`
	Bio             *string         `json:"bio"`
	Role            string          `json:"role"`
	Status          string          `json:"status"`
	EmailVerifiedAt *time.Time      `json:"-"`
	Preferences     json.RawMessage `json:"preferences"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	DeletedAt       *time.Time      `json:"-"`
}
type RefreshSession struct {
	ID           string     `json:"-"`
	UserID       string     `json:"-"`
	FamilyID     string     `json:"-"`
	TokenHash    []byte     `json:"-"`
	ReplacedByID *string    `json:"-"`
	ExpiresAt    time.Time  `json:"-"`
	RevokedAt    *time.Time `json:"-"`
	CreatedAt    time.Time  `json:"-"`
}
type PasswordResetToken struct {
	ID        string     `json:"-"`
	UserID    string     `json:"-"`
	TokenHash []byte     `json:"-"`
	ExpiresAt time.Time  `json:"-"`
	UsedAt    *time.Time `json:"-"`
	CreatedAt time.Time  `json:"-"`
}
type OauthAccount struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	Provider       string    `json:"provider"`
	ProviderUserID string    `json:"provider_user_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
type OauthState struct {
	ID        string    `json:"-"`
	StateHash []byte    `json:"-"`
	Nonce     string    `json:"-"`
	Verifier  string    `json:"-"`
	ExpiresAt time.Time `json:"-"`
	CreatedAt time.Time `json:"-"`
}
type Restaurant struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	Name        string     `json:"name"`
	Description *string    `json:"description"`
	Address     *string    `json:"address"`
	Phone       *string    `json:"phone"`
	WebsiteURL  *string    `json:"website_url"`
	Latitude    *float64   `json:"latitude"`
	Longitude   *float64   `json:"longitude"`
	MapURL      *string    `json:"map_url"`
	MapEmbedURL *string    `json:"map_embed_url"`
	PriceMin    *float64   `json:"price_min"`
	PriceMax    *float64   `json:"price_max"`
	Currency    string     `json:"currency"`
	VisitStatus string     `json:"visit_status"`
	Visibility  string     `json:"visibility"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"-"`
}
type MediaObject struct {
	ID        string    `json:"id"`
	OwnerID   string    `json:"owner_id"`
	Bucket    string    `json:"-"`
	ObjectKey string    `json:"-"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int64     `json:"size_bytes"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
type RestaurantImage struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurant_id"`
	MediaID      string    `json:"media_id"`
	AltText      *string   `json:"alt_text"`
	SortOrder    int       `json:"sort_order"`
	IsCover      bool      `json:"is_cover"`
	CreatedAt    time.Time `json:"created_at"`
}
type RestaurantMenu struct {
	ID           string    `json:"id"`
	RestaurantID string    `json:"restaurant_id"`
	Name         string    `json:"name"`
	Description  *string   `json:"description"`
	Price        *float64  `json:"price"`
	ImageMediaID *string   `json:"image_media_id"`
	SortOrder    int       `json:"sort_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
type UserProfileImage struct {
	UserID        string  `json:"user_id"`
	AvatarMediaID *string `json:"avatar_media_id"`
	CoverMediaID  *string `json:"cover_media_id"`
}
type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}
type Tag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}
type Comment struct {
	ID           string     `json:"id"`
	RestaurantID string     `json:"restaurant_id"`
	UserID       string     `json:"user_id"`
	ParentID     *string    `json:"parent_id"`
	Content      string     `json:"content"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `json:"-"`
}
type Conversation struct {
	ID         string    `json:"id"`
	UserLowID  string    `json:"-"`
	UserHighID string    `json:"-"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
type ConversationMember struct {
	ConversationID    string    `json:"conversation_id"`
	UserID            string    `json:"user_id"`
	LastReadMessageID *string   `json:"last_read_message_id"`
	JoinedAt          time.Time `json:"joined_at"`
}
type Message struct {
	ID              string     `json:"id"`
	ConversationID  string     `json:"conversation_id"`
	SenderID        string     `json:"sender_id"`
	ClientMessageID string     `json:"client_message_id"`
	Kind            string     `json:"kind"`
	Content         *string    `json:"content"`
	RestaurantID    *string    `json:"restaurant_id"`
	CreatedAt       time.Time  `json:"created_at"`
	DeletedAt       *time.Time `json:"-"`
}
