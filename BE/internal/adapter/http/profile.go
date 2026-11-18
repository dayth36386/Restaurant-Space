package httpadapter

import (
	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

func (s *Server) myProfile(c *gin.Context) {
	out, e := s.app.MyProfile(c.Request.Context(), uid(c))
	reply(c, 200, out, e)
}
func (s *Server) publicProfile(c *gin.Context) {
	out, e := s.app.PublicProfile(c.Request.Context(), c.Param("username"))
	reply(c, 200, out, e)
}
func (s *Server) updateProfile(c *gin.Context) {
	var patch usecase.Patch
	if e := bind(c, &patch); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.UpdateProfile(c.Request.Context(), uid(c), patch)
	reply(c, 200, out, e)
}
