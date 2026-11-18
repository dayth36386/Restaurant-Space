package httpadapter

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"restaurant-space/api/internal/usecase"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
)

// Realtime chat over a native WebSocket; the event contract lives in docs/realtime.md.
// The hub is in-process, which matches the single-API-process MVP. Running several
// API replicas would need a shared broker (e.g. Redis pub/sub) behind publish.

const (
	authTimeout   = 10 * time.Second
	tokenLifetime = 15 * time.Minute // matches the access token expiry
	pingInterval  = 25 * time.Second
	writeTimeout  = 10 * time.Second
	maxFrameBytes = 32 << 10
	sendBuffer    = 64
	burstEvents   = 30
	burstWindow   = 10 * time.Second

	closeUnauthorized websocket.StatusCode = 4001
)

type eventError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type event struct {
	Type  string      `json:"type"`
	Ref   string      `json:"ref,omitempty"`
	Data  any         `json:"data,omitempty"`
	Error *eventError `json:"error,omitempty"`
}
type inbound struct {
	Type string          `json:"type"`
	Ref  string          `json:"ref"`
	Data json.RawMessage `json:"data"`
}

type client struct {
	user  string
	send  chan []byte
	close context.CancelFunc
}

type hub struct {
	mu    sync.RWMutex
	users map[string]map[*client]struct{}
}

func newHub() *hub { return &hub{users: map[string]map[*client]struct{}{}} }

// add registers a connection and reports whether it is the user's first.
func (h *hub) add(c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.users[c.user]
	if set == nil {
		set = map[*client]struct{}{}
		h.users[c.user] = set
	}
	set[c] = struct{}{}
	return len(set) == 1
}

// remove unregisters a connection and reports whether it was the user's last.
func (h *hub) remove(c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	set := h.users[c.user]
	delete(set, c)
	if len(set) == 0 {
		delete(h.users, c.user)
		return true
	}
	return false
}
func (h *hub) online(user string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users[user]) > 0
}
func (h *hub) publish(users []string, ev event) {
	b, e := json.Marshal(ev)
	if e != nil {
		slog.Error("realtime encode failed", "error", e, "type", ev.Type)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, u := range users {
		for c := range h.users[u] {
			select {
			case c.send <- b:
			default:
				// Drop clients that cannot keep up; they reconnect and refetch history.
				c.close()
			}
		}
	}
}

func readUpdate(r usecase.ReadReceipt) event {
	return event{Type: "message:read_update", Data: gin.H{"conversation_id": r.ConversationID, "user_id": r.UserID, "message_id": r.MessageID}}
}

func errorEvent(ref string, err error) event {
	_, code, message := classify(err)
	return event{Type: "error", Ref: ref, Error: &eventError{code, message}}
}

func (s *Server) originPatterns() []string {
	var hosts []string
	for _, raw := range []string{s.Options.Origin, s.Options.PublicURL} {
		if u, e := url.Parse(raw); e == nil && u.Host != "" {
			hosts = append(hosts, u.Host)
		}
	}
	return hosts
}

// withPresence marks whether each conversation partner currently has a socket open.
func (s *Server) withPresence(v usecase.View) usecase.View {
	mark := func(item any) {
		if conv, ok := item.(usecase.View); ok {
			if other, ok := conv["other_user"].(usecase.View); ok {
				id, _ := other["id"].(string)
				other["online"] = s.hub.online(id)
			}
		}
	}
	if items, ok := v["items"].([]usecase.View); ok {
		for _, item := range items {
			mark(item)
		}
	} else {
		mark(v)
	}
	return v
}

func (s *Server) announcePresence(user string, online bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	partners, e := s.app.ConversationPartners(ctx, user)
	if e != nil {
		slog.Error("presence lookup failed", "error", e)
		return
	}
	s.hub.publish(partners, event{Type: "presence:update", Data: gin.H{"user_id": user, "online": online}})
}

// socket upgrades to WebSocket. The first frame must be {"type":"auth","data":{"token":...}}
// so the access token never appears in URLs or logs; re-send auth after refreshing.
func (s *Server) socket(c *gin.Context) {
	// http.Server read/write timeouts would otherwise cut the hijacked connection.
	rc := http.NewResponseController(c.Writer)
	_ = rc.SetReadDeadline(time.Time{})
	_ = rc.SetWriteDeadline(time.Time{})
	conn, e := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{OriginPatterns: s.originPatterns()})
	if e != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(maxFrameBytes)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// A timer (not a Read deadline) so the close carries 4001: cancelling a Read
	// makes the library close the socket with its own status code.
	authTimer := time.AfterFunc(authTimeout, func() { _ = conn.Close(closeUnauthorized, "auth timeout") })
	user, ref, e := s.readAuth(ctx, conn)
	authTimer.Stop()
	if e != nil {
		_ = conn.Close(closeUnauthorized, "unauthorized")
		return
	}

	cl := &client{user: user, send: make(chan []byte, sendBuffer), close: cancel}
	expiry := time.AfterFunc(tokenLifetime, func() { _ = conn.Close(closeUnauthorized, "token expired") })
	defer expiry.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case b := <-cl.send:
				wctx, wcancel := context.WithTimeout(ctx, writeTimeout)
				e := conn.Write(wctx, websocket.MessageText, b)
				wcancel()
				if e != nil {
					cancel()
					return
				}
			}
		}
	}()
	go func() {
		t := time.NewTicker(pingInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				pctx, pcancel := context.WithTimeout(ctx, writeTimeout)
				e := conn.Ping(pctx)
				pcancel()
				if e != nil {
					cancel()
					return
				}
			}
		}
	}()

	if s.hub.add(cl) {
		s.announcePresence(user, true)
	}
	defer func() {
		if s.hub.remove(cl) {
			s.announcePresence(user, false)
		}
	}()

	partners, e := s.app.ConversationPartners(ctx, user)
	if e != nil {
		return
	}
	online := []string{}
	for _, p := range partners {
		if s.hub.online(p) {
			online = append(online, p)
		}
	}
	s.reply(cl, event{Type: "ready", Ref: ref, Data: gin.H{"user_id": user, "online_user_ids": online}})

	var window time.Time
	count := 0
	for {
		_, data, e := conn.Read(ctx)
		if e != nil {
			return
		}
		if now := time.Now(); now.Sub(window) > burstWindow {
			window, count = now, 0
		}
		if count++; count > burstEvents {
			s.reply(cl, event{Type: "error", Error: &eventError{"RATE_LIMITED", "Too many events"}})
			continue
		}
		var in inbound
		if json.Unmarshal(data, &in) != nil || in.Type == "" {
			s.reply(cl, errorEvent("", bad("Invalid event")))
			continue
		}
		if in.Type == "auth" {
			again, e := s.authenticateFrame(ctx, in.Data)
			if e != nil || again != user {
				_ = conn.Close(closeUnauthorized, "unauthorized")
				return
			}
			expiry.Reset(tokenLifetime)
			s.reply(cl, event{Type: "auth:ok", Ref: in.Ref})
			continue
		}
		s.dispatch(ctx, cl, in)
	}
}

func (s *Server) reply(c *client, ev event) {
	b, _ := json.Marshal(ev)
	select {
	case c.send <- b:
	default:
		c.close()
	}
}

func (s *Server) authenticateFrame(ctx context.Context, data json.RawMessage) (string, error) {
	var body struct {
		Token string `json:"token"`
	}
	if json.Unmarshal(data, &body) != nil || body.Token == "" {
		return "", unauthorized()
	}
	return s.app.Authenticate(ctx, body.Token)
}

func (s *Server) readAuth(ctx context.Context, conn *websocket.Conn) (string, string, error) {
	_, data, e := conn.Read(ctx)
	if e != nil {
		return "", "", e
	}
	var in inbound
	if json.Unmarshal(data, &in) != nil || in.Type != "auth" {
		return "", "", errors.New("expected auth event")
	}
	user, e := s.authenticateFrame(ctx, in.Data)
	return user, in.Ref, e
}

type conversationRef struct {
	ConversationID string `json:"conversation_id"`
}

func (s *Server) dispatch(ctx context.Context, c *client, in inbound) {
	switch in.Type {
	case "ping":
		s.reply(c, event{Type: "pong", Ref: in.Ref})
	case "message:send":
		var body struct {
			conversationRef
			usecase.SendMessageInput
		}
		if json.Unmarshal(in.Data, &body) != nil {
			s.reply(c, errorEvent(in.Ref, bad("Invalid message:send payload")))
			return
		}
		sent, e := s.app.SendMessage(ctx, c.user, body.ConversationID, body.SendMessageInput)
		if e != nil {
			s.reply(c, errorEvent(in.Ref, e))
			return
		}
		s.reply(c, event{Type: "message:ack", Ref: in.Ref, Data: sent.Message})
		if sent.Created {
			s.hub.publish(sent.Recipients, event{Type: "message:new", Data: sent.Message})
		}
	case "message:read":
		var body struct {
			conversationRef
			MessageID string `json:"message_id"`
		}
		if json.Unmarshal(in.Data, &body) != nil {
			s.reply(c, errorEvent(in.Ref, bad("Invalid message:read payload")))
			return
		}
		receipt, e := s.app.MarkRead(ctx, c.user, body.ConversationID, body.MessageID)
		if e != nil {
			s.reply(c, errorEvent(in.Ref, e))
			return
		}
		s.hub.publish(receipt.Recipients, readUpdate(receipt))
	case "typing:start", "typing:stop":
		var body conversationRef
		if json.Unmarshal(in.Data, &body) != nil {
			s.reply(c, errorEvent(in.Ref, bad("Invalid typing payload")))
			return
		}
		peers, e := s.app.ConversationPeers(ctx, c.user, body.ConversationID)
		if e != nil {
			s.reply(c, errorEvent(in.Ref, e))
			return
		}
		s.hub.publish(peers, event{Type: "typing:update", Data: gin.H{"conversation_id": body.ConversationID, "user_id": c.user, "typing": in.Type == "typing:start"}})
	default:
		s.reply(c, errorEvent(in.Ref, bad("Unknown event type")))
	}
}
