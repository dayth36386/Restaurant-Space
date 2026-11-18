package httpadapter

import (
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-space/api/internal/usecase"
)

var imageSlots = make(chan struct{}, 2)

func (s *Server) upload(c *gin.Context) {
	select {
	case imageSlots <- struct{}{}:
		defer func() { <-imageSlots }()
	default:
		fail(c, &apiError{429, "UPLOAD_BUSY", "Try again shortly"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, usecase.MaxImageBytes+(1<<20))
	if e := c.Request.ParseMultipartForm(usecase.MaxImageBytes); e != nil {
		fail(c, bad("Invalid multipart body or upload exceeds 8 MiB"))
		return
	}
	defer func() {
		// Spilled upload parts live in temp files; a failed cleanup would leak disk.
		if e := c.Request.MultipartForm.RemoveAll(); e != nil {
			slog.Warn("multipart cleanup failed", "error", e)
		}
	}()
	file, _, e := c.Request.FormFile("file")
	if e != nil {
		fail(c, bad("A file field is required"))
		return
	}
	defer file.Close()
	raw, e := io.ReadAll(io.LimitReader(file, usecase.MaxImageBytes+1))
	if e != nil {
		fail(c, bad("Unable to read image"))
		return
	}
	out, e := s.app.Upload(c.Request.Context(), uid(c), raw)
	reply(c, 201, out, e)
}
func (s *Server) uploadDetail(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.UploadDetail(c.Request.Context(), uid(c), id)
	reply(c, 200, out, e)
}
func (s *Server) attachImage(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	var in usecase.AttachImageInput
	if e = bind(c, &in); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.AttachImage(c.Request.Context(), uid(c), id, in)
	reply(c, 201, out, e)
}
func (s *Server) updateImage(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	imageID, e := idParam(c, "imageId")
	if e != nil {
		fail(c, e)
		return
	}
	var patch usecase.Patch
	if e = bind(c, &patch); e != nil {
		fail(c, e)
		return
	}
	out, e := s.app.UpdateImage(c.Request.Context(), uid(c), id, imageID, patch)
	reply(c, 200, out, e)
}
func (s *Server) deleteImage(c *gin.Context) {
	id, e := idParam(c, "id")
	if e != nil {
		fail(c, e)
		return
	}
	imageID, e := idParam(c, "imageId")
	if e != nil {
		fail(c, e)
		return
	}
	reply(c, 204, nil, s.app.DeleteImage(c.Request.Context(), uid(c), id, imageID))
}
