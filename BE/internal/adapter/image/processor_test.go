package imageprocessor

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func TestNormalizeImage(t *testing.T) {
	im := image.NewRGBA(image.Rect(0, 0, 3, 2))
	im.Set(0, 0, color.RGBA{R: 255, A: 255})
	var b bytes.Buffer
	if e := png.Encode(&b, im); e != nil {
		t.Fatal(e)
	}
	data, w, h, e := (Processor{}).Normalize(b.Bytes())
	if e != nil || w != 3 || h != 2 {
		t.Fatalf("normalize: %d %d %v", w, h, e)
	}
	if _, e = jpeg.Decode(bytes.NewReader(data)); e != nil {
		t.Fatal(e)
	}
	for _, raw := range [][]byte{[]byte(`<svg xmlns="http://www.w3.org/2000/svg"/>`), []byte("not an image"), b.Bytes()[:20]} {
		if _, _, _, e = (Processor{}).Normalize(raw); e == nil {
			t.Fatal("invalid image accepted")
		}
	}
}
func TestResizeImage(t *testing.T) {
	im := image.NewRGBA(image.Rect(0, 0, 2050, 2))
	var b bytes.Buffer
	_ = png.Encode(&b, im)
	_, w, h, e := (Processor{}).Normalize(b.Bytes())
	if e != nil || w != 2048 || h < 1 {
		t.Fatalf("resize: %dx%d %v", w, h, e)
	}
}
