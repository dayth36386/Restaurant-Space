package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

const (
	maxMessageLength   = 4000
	maxConversationRow = 100
)

type StartConversationInput struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

type SendMessageInput struct {
	ClientMessageID string  `json:"client_message_id"`
	Content         *string `json:"content"`
	RestaurantID    *string `json:"restaurant_id"`
}

// SentMessage is a persisted message plus who should receive the realtime event.
type SentMessage struct {
	Message    View
	Recipients []string
	Created    bool
}

// ReadReceipt tells the other members how far a user has read.
type ReadReceipt struct {
	ConversationID, UserID, MessageID string
	Recipients                        []string
}

func pair(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

// member returns the caller's membership, hiding conversations they are not in.
func member(r port.Repository, conversation, user string, lock bool) (domain.ConversationMember, error) {
	if !validID(conversation) {
		return domain.ConversationMember{}, bad("Invalid conversation UUID")
	}
	m, e := r.Member(conversation, user, lock)
	if errors.Is(e, domain.ErrNotFound) {
		return m, domain.ErrNotFound
	}
	return m, e
}

func (s *Service) StartConversation(ctx context.Context, user string, in StartConversationInput) (View, bool, error) {
	r := s.db.Repository(ctx)
	var other domain.User
	var e error
	switch {
	case in.UserID != "" && validID(in.UserID):
		other, e = r.User(in.UserID, false)
	case in.UserID == "" && in.Username != "":
		other, e = r.UserByUsername(strings.ToLower(strings.TrimSpace(in.Username)))
	default:
		return nil, false, bad("Provide user_id or username")
	}
	if e != nil {
		return nil, false, e
	}
	if !active(other) {
		return nil, false, domain.ErrNotFound
	}
	if other.ID == user {
		return nil, false, bad("Cannot start a conversation with yourself")
	}
	low, high := pair(user, other.ID)
	c, e := r.ConversationByPair(low, high)
	created := false
	if errors.Is(e, domain.ErrNotFound) {
		c = domain.Conversation{ID: newID(), UserLowID: low, UserHighID: high}
		members := []domain.ConversationMember{{ConversationID: c.ID, UserID: low}, {ConversationID: c.ID, UserID: high}}
		e = s.db.Transaction(ctx, func(tx port.Repository) error { return tx.CreateConversation(&c, members) })
		created = e == nil
		// A concurrent request created the pair first; use that one.
		if errors.Is(e, domain.ErrConflict) {
			c, e = r.ConversationByPair(low, high)
		}
	}
	if e != nil {
		return nil, false, e
	}
	v, e := s.ConversationDetail(ctx, user, c.ID)
	return v, created, e
}

func (s *Service) conversationView(ctx context.Context, user string, c domain.Conversation, people *users) (View, error) {
	r := s.db.Repository(ctx)
	otherID := c.UserLowID
	if otherID == user {
		otherID = c.UserHighID
	}
	other, e := people.get(otherID)
	if e != nil {
		return nil, e
	}
	var last any
	m, e := r.LastMessage(c.ID)
	switch {
	case e == nil:
		if last, e = s.messageView(ctx, user, m); e != nil {
			return nil, e
		}
	case !errors.Is(e, domain.ErrNotFound):
		return nil, e
	}
	unread, e := r.UnreadCount(c.ID, user)
	if e != nil {
		return nil, e
	}
	members, e := r.Members(c.ID)
	if e != nil {
		return nil, e
	}
	var otherRead *string
	for _, mem := range members {
		if mem.UserID == otherID {
			otherRead = mem.LastReadMessageID
		}
	}
	return View{"id": c.ID, "other_user": other, "last_message": last, "unread_count": unread, "other_last_read_message_id": otherRead, "created_at": c.CreatedAt, "updated_at": c.UpdatedAt}, nil
}

func (s *Service) Conversations(ctx context.Context, user string) (View, error) {
	rows, e := s.db.Repository(ctx).Conversations(user, maxConversationRow)
	if e != nil {
		return nil, e
	}
	people := s.users(ctx)
	items := make([]View, 0, len(rows))
	for _, c := range rows {
		v, e := s.conversationView(ctx, user, c, people)
		if e != nil {
			return nil, e
		}
		items = append(items, v)
	}
	return View{"items": items}, nil
}

func (s *Service) ConversationDetail(ctx context.Context, user, id string) (View, error) {
	r := s.db.Repository(ctx)
	if _, e := member(r, id, user, false); e != nil {
		return nil, e
	}
	c, e := r.Conversation(id)
	if e != nil {
		return nil, e
	}
	return s.conversationView(ctx, user, c, s.users(ctx))
}

// messageView renders a message for one viewer; a shared restaurant is only
// expanded while it is still visible to that viewer.
func (s *Service) messageView(ctx context.Context, viewer string, m domain.Message) (View, error) {
	out := View{"id": m.ID, "conversation_id": m.ConversationID, "sender_id": m.SenderID, "client_message_id": m.ClientMessageID, "kind": m.Kind, "content": m.Content, "restaurant": nil, "created_at": m.CreatedAt}
	if m.Kind == "RESTAURANT" && m.RestaurantID != nil {
		v, e := s.visible(ctx, *m.RestaurantID, viewer)
		switch {
		case e == nil:
			card, e := s.restaurantCard(ctx, v, s.users(ctx))
			if e != nil {
				return nil, e
			}
			out["restaurant"] = card
		case !errors.Is(e, domain.ErrNotFound):
			return nil, e
		}
	}
	return out, nil
}

func (s *Service) Messages(ctx context.Context, user, conversation string, limit int, raw string) (View, error) {
	r := s.db.Repository(ctx)
	if _, e := member(r, conversation, user, false); e != nil {
		return nil, e
	}
	limit, cur, e := page(limit, raw)
	if e != nil {
		return nil, e
	}
	f := port.MessageFilter{ConversationID: conversation, Limit: limit + 1}
	if cur != nil {
		f.BeforeTime, f.BeforeID = cur.Time, cur.ID
	}
	rows, e := r.Messages(f)
	if e != nil {
		return nil, e
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		next = encodeCursor(last.CreatedAt, last.ID)
	}
	items := make([]View, 0, len(rows))
	for _, m := range rows {
		v, e := s.messageView(ctx, user, m)
		if e != nil {
			return nil, e
		}
		items = append(items, v)
	}
	return View{"items": items, "next_cursor": next}, nil
}

func memberIDs(members []domain.ConversationMember, except string) []string {
	ids := make([]string, 0, len(members))
	for _, m := range members {
		if m.UserID != except {
			ids = append(ids, m.UserID)
		}
	}
	return ids
}

// SendMessage persists a message once per client_message_id; retries return
// the original message with Created=false.
func (s *Service) SendMessage(ctx context.Context, user, conversation string, in SendMessageInput) (SentMessage, error) {
	if !validID(in.ClientMessageID) {
		return SentMessage{}, bad("client_message_id must be a UUID")
	}
	m := domain.Message{ID: newID(), ConversationID: conversation, SenderID: user, ClientMessageID: strings.ToLower(in.ClientMessageID)}
	switch {
	case in.RestaurantID != nil && in.Content == nil:
		if !validID(*in.RestaurantID) {
			return SentMessage{}, bad("Invalid restaurant_id")
		}
		v, e := s.visible(ctx, *in.RestaurantID, user)
		if e != nil {
			return SentMessage{}, e
		}
		if v.Visibility != "PUBLIC" {
			return SentMessage{}, bad("Only public restaurants can be shared")
		}
		m.Kind, m.RestaurantID = "RESTAURANT", in.RestaurantID
	case in.Content != nil && in.RestaurantID == nil:
		content, e := cleanContent(*in.Content, maxMessageLength)
		if e != nil {
			return SentMessage{}, e
		}
		m.Kind, m.Content = "TEXT", &content
	default:
		return SentMessage{}, bad("Provide either content or restaurant_id")
	}

	r := s.db.Repository(ctx)
	if _, e := member(r, conversation, user, false); e != nil {
		return SentMessage{}, e
	}
	members, e := r.Members(conversation)
	if e != nil {
		return SentMessage{}, e
	}
	created := true
	e = s.db.Transaction(ctx, func(tx port.Repository) error {
		if e := tx.CreateMessage(&m); e != nil {
			return e
		}
		return tx.TouchConversation(conversation, time.Now().UTC())
	})
	if errors.Is(e, domain.ErrConflict) {
		m, e = r.MessageByClientID(conversation, user, m.ClientMessageID)
		created = false
	}
	if e != nil {
		return SentMessage{}, e
	}
	if created {
		// Reload to pick up database-assigned timestamps.
		if m, e = r.Message(conversation, m.ID); e != nil {
			return SentMessage{}, e
		}
	}
	v, e := s.messageView(ctx, user, m)
	if e != nil {
		return SentMessage{}, e
	}
	return SentMessage{Message: v, Recipients: memberIDs(members, ""), Created: created}, nil
}

// MarkRead moves the caller's read cursor forward only.
func (s *Service) MarkRead(ctx context.Context, user, conversation, messageID string) (ReadReceipt, error) {
	if !validID(messageID) {
		return ReadReceipt{}, bad("Invalid message_id")
	}
	var members []domain.ConversationMember
	e := s.db.Transaction(ctx, func(r port.Repository) error {
		mem, e := member(r, conversation, user, true)
		if e != nil {
			return e
		}
		target, e := r.Message(conversation, messageID)
		if e != nil {
			return e
		}
		if mem.LastReadMessageID != nil {
			current, e := r.Message(conversation, *mem.LastReadMessageID)
			if e != nil {
				return e
			}
			newer := target.CreatedAt.After(current.CreatedAt) || (target.CreatedAt.Equal(current.CreatedAt) && target.ID > current.ID)
			if !newer {
				messageID = current.ID
				members, e = r.Members(conversation)
				return e
			}
		}
		mem.LastReadMessageID = &target.ID
		if e = r.SaveMember(&mem); e != nil {
			return e
		}
		members, e = r.Members(conversation)
		return e
	})
	if e != nil {
		return ReadReceipt{}, e
	}
	return ReadReceipt{ConversationID: conversation, UserID: user, MessageID: messageID, Recipients: memberIDs(members, "")}, nil
}

// ConversationPeers checks membership and returns the other members (for typing events).
func (s *Service) ConversationPeers(ctx context.Context, user, conversation string) ([]string, error) {
	r := s.db.Repository(ctx)
	if _, e := member(r, conversation, user, false); e != nil {
		return nil, e
	}
	members, e := r.Members(conversation)
	if e != nil {
		return nil, e
	}
	return memberIDs(members, user), nil
}

// ConversationPartners lists users who should see this user's presence.
func (s *Service) ConversationPartners(ctx context.Context, user string) ([]string, error) {
	return s.db.Repository(ctx).ConversationPartners(user)
}
