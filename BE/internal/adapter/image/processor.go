package imageprocessor

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"restaurant-space/api/internal/domain"
	"restaurant-space/api/internal/port"
)

type Processor struct{}

var _ port.ImageProcessor = Processor{}

func (Processor) Normalize(raw []byte) ([]byte, int, int, error) {
	cfg, format, e := image.DecodeConfig(bytes.NewReader(raw))
	if e != nil || (format != "jpeg" && format != "png" && format != "webp") {
		return nil, 0, 0, domain.Invalid("Only valid JPEG, PNG and WebP images are supported")
	}
	if cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 10000 || cfg.Height > 10000 || int64(cfg.Width)*int64(cfg.Height) > 20000000 {
		return nil, 0, 0, domain.Invalid("Image exceeds dimension limit (20 megapixels)")
	}
	im, _, e := image.Decode(bytes.NewReader(raw))
	if e != nil {
		return nil, 0, 0, domain.Invalid("Unable to decode image")
	}
	w, h := cfg.Width, cfg.Height
	if w > 2048 || h > 2048 {
		if w >= h {
			h = h * 2048 / w
			w = 2048
		} else {
			w = w * 2048 / h
			h = 2048
		}
	}
	if w < 1 {
		w = 1
	}
	if h < 1 {
		h = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), im, im.Bounds(), draw.Over, nil)
	var out bytes.Buffer
	if e = jpeg.Encode(&out, dst, &jpeg.Options{Quality: 85}); e != nil {
		return nil, 0, 0, e
	}
	return out.Bytes(), w, h, nil
}
