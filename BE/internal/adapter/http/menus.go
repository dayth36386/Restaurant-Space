package httpadapter

import (
	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

func (s *Server) createMenu(c *gin.Context) { s.saveMenu(c, true) }
func (s *Server) updateMenu(c *gin.Context) { s.saveMenu(c, false) }
func (s *Server) saveMenu(c *gin.Context, create bool) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	menuID := ""
	status := 201
	if !create {
		menuID, e = idParam(c, "menuId")
		if e != nil {
			fail(c, e)
			return
		}
		status = 200
	}
	var patch usecase.Patch
	if e = bind(c, &patch); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.SaveMenu(c.Request.Context(), uid(c), id, menuID, patch)
	reply(c, status, out, e)
}
func (s *Server) deleteMenu(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	menuID, e := idParam(c, "menuId")
	if e != nil {
		fail(c, e)
		return
	}
	reply(c, 204, nil, s.app.DeleteMenu(c.Request.Context(), uid(c), id, menuID))
}
