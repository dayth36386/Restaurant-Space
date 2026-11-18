package port

import (
	"context"
	"time"

	"restaurant-space/api/internal/domain"
)

// UnitOfWork keeps the transaction boundary in the use case and SQL in the adapter.
// Context-scoped and transaction repositories carry the supplied request context.
type UnitOfWork interface {
	Repository(context.Context) Repository
	Transaction(context.Context, func(Repository) error) error
	Ready(context.Context) error
}
type Repository interface {
	Accounts
	Restaurants
	Media
	Social
	Chat
}
type Accounts interface {
	User(string, bool) (domain.User, error)
	UserByEmail(string) (domain.User, error)
	UserByUsername(string) (domain.User, error)
	CreateUser(*domain.User) error
	SaveUser(*domain.User) error
	SessionByHash([]byte) (domain.RefreshSession, error)
	Session(string, bool) (domain.RefreshSession, error)
	CreateSession(*domain.RefreshSession) error
	SaveSession(*domain.RefreshSession) error
	ActiveFamily(string, string, time.Time) (bool, error)
	RevokeFamily(string, time.Time) error
	RevokeUserSessions(string, time.Time) error
	ResetByHash([]byte) (domain.PasswordResetToken, error)
	ResetToken(string, bool) (domain.PasswordResetToken, error)
	CreateReset(*domain.PasswordResetToken) error
	ConsumeResets(string, time.Time) error
	CreateOAuthState(*domain.OauthState) error
	ConsumeOAuthState([]byte, time.Time) (domain.OauthState, error)
	OAuthAccount(string) (domain.OauthAccount, error)
	CreateOAuthAccount(*domain.OauthAccount) error
	ProfileImages(string) (domain.UserProfileImage, error)
	SaveProfileImages(*domain.UserProfileImage) error
	DeleteExpiredOAuthStates(time.Time) error
}
type RestaurantFilter struct {
	ViewerID, OwnerID, Query, VisitStatus, CategoryID string
	PublicOnly                                        bool
	Limit                                             int
	BeforeTime                                        time.Time
	BeforeID                                          string
}
type Restaurants interface {
	Restaurant(string, bool) (domain.Restaurant, error)
	ListRestaurants(RestaurantFilter) ([]domain.Restaurant, error)
	CreateRestaurant(*domain.Restaurant) error
	SaveRestaurant(*domain.Restaurant) error
	SetTaxonomy(string, []string, []string) error
	RestaurantTaxonomy(string) ([]domain.Category, []domain.Tag, error)
	Categories() ([]domain.Category, error)
	Tags() ([]domain.Tag, error)
	PublicRestaurantCount(string) (int64, error)
	SocialCounts(string) (int64, int64, error)
	Images(string) ([]domain.RestaurantImage, error)
	Image(string, string) (domain.RestaurantImage, error)
	CreateImage(*domain.RestaurantImage) error
	SaveImage(*domain.RestaurantImage) error
	ClearCover(string) error
	DeleteImage(string, string) error
	Menus(string) ([]domain.RestaurantMenu, error)
	Menu(string, string) (domain.RestaurantMenu, error)
	CreateMenu(*domain.RestaurantMenu) error
	SaveMenu(*domain.RestaurantMenu) error
	DeleteMenu(string, string) error
}
type Media interface {
	MediaObject(string, bool) (domain.MediaObject, error)
	CreateMedia(*domain.MediaObject) error
	SaveMedia(*domain.MediaObject) error
	CleanupCandidates(time.Time, int) ([]domain.MediaObject, error)
	MediaReferenced(string) (bool, error)
	DeleteMedia(string) error
}

type CommentFilter struct {
	RestaurantID string
	Limit        int
	BeforeTime   time.Time
	BeforeID     string
}

// Social covers comments and likes on restaurants.
type Social interface {
	Comment(string, bool) (domain.Comment, error)
	// ListComments returns top-level comments newest first, including deleted
	// ones that still have visible replies.
	ListComments(CommentFilter) ([]domain.Comment, error)
	// Replies returns visible replies to the given parents, oldest first.
	Replies(string, []string) ([]domain.Comment, error)
	CreateComment(*domain.Comment) error
	SaveComment(*domain.Comment) error
	SetLike(user, restaurant string, liked bool) error
	Liked(user, restaurant string) (bool, error)
}

type MessageFilter struct {
	ConversationID string
	Limit          int
	BeforeTime     time.Time
	BeforeID       string
}

// Chat covers direct conversations; a pair of users shares one conversation.
type Chat interface {
	Conversation(string) (domain.Conversation, error)
	ConversationByPair(low, high string) (domain.Conversation, error)
	CreateConversation(*domain.Conversation, []domain.ConversationMember) error
	// Conversations lists the user's conversations, most recently active first.
	Conversations(user string, limit int) ([]domain.Conversation, error)
	Members(conversation string) ([]domain.ConversationMember, error)
	Member(conversation, user string, lock bool) (domain.ConversationMember, error)
	SaveMember(*domain.ConversationMember) error
	// ConversationPartners lists every user who shares a conversation with the user.
	ConversationPartners(user string) ([]string, error)
	Messages(MessageFilter) ([]domain.Message, error)
	Message(conversation, id string) (domain.Message, error)
	MessageByClientID(conversation, sender, clientID string) (domain.Message, error)
	LastMessage(conversation string) (domain.Message, error)
	CreateMessage(*domain.Message) error
	TouchConversation(string, time.Time) error
	// UnreadCount counts messages from others after the member's read cursor.
	UnreadCount(conversation, user string) (int64, error)
}
