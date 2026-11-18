package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

// socialRepo fakes only what comment/chat use cases touch.
type socialRepo struct {
	port.Repository
	restaurants map[string]domain.Restaurant
	comments    map[string]domain.Comment
	members     map[string][]domain.ConversationMember
	messages    map[string]domain.Message
	created     []domain.Comment
	sent        []domain.Message
	saved       int
	duplicate   bool
}

func newSocialRepo() *socialRepo {
	return &socialRepo{restaurants: map[string]domain.Restaurant{}, comments: map[string]domain.Comment{}, members: map[string][]domain.ConversationMember{}, messages: map[string]domain.Message{}}
}
func (f *socialRepo) User(id string, _ bool) (domain.User, error) {
	return domain.User{ID: id, Username: "u" + id[:4], Status: "ACTIVE"}, nil
}
func (f *socialRepo) ProfileImages(string) (domain.UserProfileImage, error) {
	return domain.UserProfileImage{}, domain.ErrNotFound
}
func (f *socialRepo) Restaurant(id string, _ bool) (domain.Restaurant, error) {
	if v, ok := f.restaurants[id]; ok {
		return v, nil
	}
	return domain.Restaurant{}, domain.ErrNotFound
}
func (f *socialRepo) Comment(id string, _ bool) (domain.Comment, error) {
	if v, ok := f.comments[id]; ok {
		return v, nil
	}
	return domain.Comment{}, domain.ErrNotFound
}
func (f *socialRepo) CreateComment(v *domain.Comment) error {
	f.created = append(f.created, *v)
	f.comments[v.ID] = *v
	return nil
}
func (f *socialRepo) SaveComment(v *domain.Comment) error {
	f.saved++
	f.comments[v.ID] = *v
	return nil
}
func (f *socialRepo) Member(conversation, user string, _ bool) (domain.ConversationMember, error) {
	for _, m := range f.members[conversation] {
		if m.UserID == user {
			return m, nil
		}
	}
	return domain.ConversationMember{}, domain.ErrNotFound
}
func (f *socialRepo) Members(conversation string) ([]domain.ConversationMember, error) {
	return f.members[conversation], nil
}
func (f *socialRepo) SaveMember(v *domain.ConversationMember) error {
	for i, m := range f.members[v.ConversationID] {
		if m.UserID == v.UserID {
			f.members[v.ConversationID][i] = *v
		}
	}
	f.saved++
	return nil
}
func (f *socialRepo) CreateMessage(v *domain.Message) error {
	if f.duplicate {
		return domain.ErrConflict
	}
	v.CreatedAt = time.Now()
	f.sent = append(f.sent, *v)
	f.messages[v.ID] = *v
	return nil
}
func (f *socialRepo) TouchConversation(string, time.Time) error { return nil }
func (f *socialRepo) Message(_, id string) (domain.Message, error) {
	if v, ok := f.messages[id]; ok {
		return v, nil
	}
	return domain.Message{}, domain.ErrNotFound
}
func (f *socialRepo) MessageByClientID(_, sender, client string) (domain.Message, error) {
	for _, m := range f.messages {
		if m.SenderID == sender && m.ClientMessageID == client {
			return m, nil
		}
	}
	return domain.Message{}, domain.ErrNotFound
}

type socialUoW struct{ r *socialRepo }

func (f socialUoW) Repository(context.Context) port.Repository { return f.r }
func (f socialUoW) Transaction(_ context.Context, fn func(port.Repository) error) error {
	return fn(f.r)
}
func (f socialUoW) Ready(context.Context) error { return nil }

var (
	owner = "00000000-0000-4000-8000-000000000001"
	other = "00000000-0000-4000-8000-000000000002"
	third = "00000000-0000-4000-8000-000000000003"
	pub   = "00000000-0000-4000-8000-0000000000a1"
	priv  = "00000000-0000-4000-8000-0000000000a2"
	conv  = "00000000-0000-4000-8000-0000000000c1"
)

func socialService() (*Service, *socialRepo) {
	r := newSocialRepo()
	r.restaurants[pub] = domain.Restaurant{ID: pub, UserID: owner, Visibility: "PUBLIC"}
	r.restaurants[priv] = domain.Restaurant{ID: priv, UserID: owner, Visibility: "PRIVATE"}
	r.members[conv] = []domain.ConversationMember{{ConversationID: conv, UserID: owner}, {ConversationID: conv, UserID: other}}
	return New(Dependencies{Database: socialUoW{r}}), r
}

func TestCommentsRequirePublicRestaurant(t *testing.T) {
	s, r := socialService()
	ctx := context.Background()
	if _, e := s.CreateComment(ctx, other, priv, CommentInput{Content: "hi"}); !errors.Is(e, domain.ErrNotFound) {
		t.Fatalf("private restaurant visible to non-owner: %v", e)
	}
	var invalid *domain.Error
	if _, e := s.CreateComment(ctx, owner, priv, CommentInput{Content: "hi"}); !errors.As(e, &invalid) {
		t.Fatalf("comment allowed on private restaurant: %v", e)
	}
	if _, e := s.CreateComment(ctx, other, pub, CommentInput{Content: "   "}); !errors.As(e, &invalid) {
		t.Fatal("blank comment accepted")
	}
	if len(r.created) != 0 {
		t.Fatal("rejected comments were stored")
	}
}

func TestReplyToReplyAttachesToTopLevel(t *testing.T) {
	s, r := socialService()
	top := newID()
	child := newID()
	r.comments[top] = domain.Comment{ID: top, RestaurantID: pub, UserID: owner, Content: "top"}
	r.comments[child] = domain.Comment{ID: child, RestaurantID: pub, UserID: other, Content: "child", ParentID: &top}
	if _, e := s.CreateComment(context.Background(), third, pub, CommentInput{Content: "grandchild", ParentID: &child}); e != nil {
		t.Fatal(e)
	}
	if got := r.created[0].ParentID; got == nil || *got != top {
		t.Fatalf("reply attached to %v, want %s", got, top)
	}
	foreign := newID()
	r.comments[foreign] = domain.Comment{ID: foreign, RestaurantID: priv, UserID: owner, Content: "x"}
	if _, e := s.CreateComment(context.Background(), third, pub, CommentInput{Content: "x", ParentID: &foreign}); e == nil {
		t.Fatal("reply accepted under another restaurant's comment")
	}
}

func TestOnlyAuthorEditsOrDeletesComment(t *testing.T) {
	s, r := socialService()
	id := newID()
	r.comments[id] = domain.Comment{ID: id, RestaurantID: pub, UserID: owner, Content: "mine"}
	if _, e := s.UpdateComment(context.Background(), other, id, CommentInput{Content: "hijack"}); !errors.Is(e, domain.ErrNotFound) {
		t.Fatalf("non-author edited: %v", e)
	}
	if e := s.DeleteComment(context.Background(), other, id); !errors.Is(e, domain.ErrNotFound) {
		t.Fatalf("non-author deleted: %v", e)
	}
	if r.saved != 0 {
		t.Fatal("non-author change was saved")
	}
	if e := s.DeleteComment(context.Background(), owner, id); e != nil || r.comments[id].DeletedAt == nil {
		t.Fatal("author could not soft-delete")
	}
}

func TestSendMessageAuthorization(t *testing.T) {
	s, r := socialService()
	ctx := context.Background()
	text := "hello"
	if _, e := s.SendMessage(ctx, third, conv, SendMessageInput{ClientMessageID: newID(), Content: &text}); !errors.Is(e, domain.ErrNotFound) {
		t.Fatalf("non-member sent message: %v", e)
	}
	var invalid *domain.Error
	if _, e := s.SendMessage(ctx, owner, conv, SendMessageInput{ClientMessageID: newID(), RestaurantID: &priv}); !errors.As(e, &invalid) {
		t.Fatalf("private restaurant shared: %v", e)
	}
	if _, e := s.SendMessage(ctx, owner, conv, SendMessageInput{ClientMessageID: newID(), Content: &text, RestaurantID: &pub}); !errors.As(e, &invalid) {
		t.Fatal("ambiguous message accepted")
	}
	if len(r.sent) != 0 {
		t.Fatal("rejected messages were stored")
	}
	sent, e := s.SendMessage(ctx, owner, conv, SendMessageInput{ClientMessageID: newID(), Content: &text})
	if e != nil || !sent.Created || len(sent.Recipients) != 2 {
		t.Fatalf("member send failed: %+v %v", sent, e)
	}
}

func TestSendMessageRetryReturnsOriginal(t *testing.T) {
	s, r := socialService()
	text := "hello"
	clientID := newID()
	first, e := s.SendMessage(context.Background(), owner, conv, SendMessageInput{ClientMessageID: clientID, Content: &text})
	if e != nil {
		t.Fatal(e)
	}
	r.duplicate = true
	again, e := s.SendMessage(context.Background(), owner, conv, SendMessageInput{ClientMessageID: clientID, Content: &text})
	if e != nil || again.Created || again.Message["id"] != first.Message["id"] {
		t.Fatalf("retry did not return original: %+v %v", again, e)
	}
}

func TestMarkReadNeverMovesBackwards(t *testing.T) {
	s, r := socialService()
	older := domain.Message{ID: newID(), ConversationID: conv, SenderID: other, CreatedAt: time.Now().Add(-time.Minute)}
	newer := domain.Message{ID: newID(), ConversationID: conv, SenderID: other, CreatedAt: time.Now()}
	r.messages[older.ID], r.messages[newer.ID] = older, newer
	if _, e := s.MarkRead(context.Background(), owner, conv, newer.ID); e != nil {
		t.Fatal(e)
	}
	receipt, e := s.MarkRead(context.Background(), owner, conv, older.ID)
	if e != nil || receipt.MessageID != newer.ID || *r.members[conv][0].LastReadMessageID != newer.ID {
		t.Fatalf("read cursor moved backwards: %+v %v", receipt, e)
	}
}

func TestCannotChatWithSelf(t *testing.T) {
	s, _ := socialService()
	var invalid *domain.Error
	if _, _, e := s.StartConversation(context.Background(), owner, StartConversationInput{UserID: owner}); !errors.As(e, &invalid) {
		t.Fatalf("self conversation allowed: %v", e)
	}
}
