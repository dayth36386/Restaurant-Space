package httpadapter

import (
	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

func (s *Server) listConversations(c *gin.Context) {
	out, e := s.app.Conversations(c.Request.Context(), uid(c))
	if e == nil {
		out = s.withPresence(out)
	}
	reply(c, 200, out, e)
}
func (s *Server) startConversation(c *gin.Context) {
	var in usecase.StartConversationInput
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, created, e := s.app.StartConversation(c.Request.Context(), uid(c), in)
	status := 200
	if created {
		status = 201
	}
	if e == nil {
		out = s.withPresence(out)
	}
	reply(c, status, out, e)
}
func (s *Server) conversationDetail(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.ConversationDetail(c.Request.Context(), uid(c), id)
	if e == nil {
		out = s.withPresence(out)
	}
	reply(c, 200, out, e)
}
func (s *Server) listMessages(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	limit, e := queryLimit(c)
	if e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.Messages(c.Request.Context(), uid(c), id, limit, c.Query("cursor"))
	reply(c, 200, out, e)
}

// sendMessage is the HTTP fallback for message:send; it fans out the same realtime event.
func (s *Server) sendMessage(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var in usecase.SendMessageInput
	if e = bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	sent, e := s.app.SendMessage(c.Request.Context(), uid(c), id, in)
	if e != nil {
		fail(c, e)
		return
	}
	if sent.Created {
		s.hub.publish(sent.Recipients, event{Type: "message:new", Data: sent.Message})
		c.JSON(201, sent.Message)
		return
	}
	c.JSON(200, sent.Message)
}
func (s *Server) markRead(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var in struct {
		MessageID string `json:"message_id"`
	}
	if e = bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	receipt, e := s.app.MarkRead(c.Request.Context(), uid(c), id, in.MessageID)
	if e != nil {
		fail(c, e)
		return
	}
	s.hub.publish(receipt.Recipients, readUpdate(receipt))
	c.Status(204)
}
