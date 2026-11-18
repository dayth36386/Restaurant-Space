package httpadapter

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

func reply(c *gin.Context, status int, out any, e error) {
	if e != nil {
		fail(c, e)
		return
	}
	if status == 204 {
		c.Status(status)
		return
	}
	c.JSON(status, out)
}
func (s *Server) feed(c *gin.Context)            { s.restaurantList(c, true) }
func (s *Server) listRestaurants(c *gin.Context) { s.restaurantList(c, false) }
func (s *Server) restaurantList(c *gin.Context, public bool) {
	limit := 20
	if raw := c.Query("limit"); raw != "" {
		v, e := strconv.Atoi(raw)
		if e != nil || v < 1 || v > 100 {
			fail(c, bad("limit must be 1-100"))
			return
		}
		limit = v
	}
	in := usecase.ListInput{Limit: limit, Cursor: c.Query("cursor"), Query: c.Query("q"), OwnerID: c.Query("user_id"), VisitStatus: c.Query("visit_status"), CategoryID: c.Query("category_id"), Mine: c.Query("mine") == "true", PublicOnly: public}
	out, e := s.app.ListRestaurants(c.Request.Context(), uid(c), in)
	reply(c, 200, out, e)
}
func (s *Server) createRestaurant(c *gin.Context) {
	in := usecase.RestaurantInput{Currency: "THB", Visibility: "PRIVATE", VisitStatus: "WANT_TO_GO"}
	if e := bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.CreateRestaurant(c.Request.Context(), uid(c), in)
	reply(c, 201, out, e)
}
func (s *Server) restaurantDetail(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.RestaurantDetail(c.Request.Context(), uid(c), id)
	reply(c, 200, out, e)
}
func (s *Server) updateRestaurant(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var patch usecase.Patch
	if e = bind(c, &patch); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.UpdateRestaurant(c.Request.Context(), uid(c), id, patch)
	reply(c, 200, out, e)
}
func (s *Server) deleteRestaurant(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	reply(c, 204, nil, s.app.DeleteRestaurant(c.Request.Context(), uid(c), id))
}
func (s *Server) categories(c *gin.Context) {
	out, e := s.app.Categories(c.Request.Context())
	reply(c, 200, out, e)
}
func (s *Server) tags(c *gin.Context) {
	out, e := s.app.Tags(c.Request.Context())
	reply(c, 200, out, e)
}
