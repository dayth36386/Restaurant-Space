package httpadapter

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

func queryLimit(c *gin.Context) (int, error) {
	raw := c.Query("limit")
	if raw == "" {
		return 20, nil
	}
	v, e := strconv.Atoi(raw)
	if e != nil || v < 1 || v > 100 {
		return 0, bad("limit must be 1-100")
	}
	return v, nil
}
func (s *Server) listComments(c *gin.Context) {
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
	out, e := s.app.ListComments(c.Request.Context(), uid(c), id, limit, c.Query("cursor"))
	reply(c, 200, out, e)
}
func (s *Server) createComment(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var in usecase.CommentInput
	if e = bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.CreateComment(c.Request.Context(), uid(c), id, in)
	reply(c, 201, out, e)
}
func (s *Server) updateComment(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var in usecase.CommentInput
	if e = bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.UpdateComment(c.Request.Context(), uid(c), id, in)
	reply(c, 200, out, e)
}
func (s *Server) deleteComment(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	reply(c, 204, nil, s.app.DeleteComment(c.Request.Context(), uid(c), id))
}
func (s *Server) like(c *gin.Context)   { s.setLike(c, true) }
func (s *Server) unlike(c *gin.Context) { s.setLike(c, false) }
func (s *Server) setLike(c *gin.Context, liked bool) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.SetLike(c.Request.Context(), uid(c), id, liked)
	reply(c, 200, out, e)
}
