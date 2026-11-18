package usecase

import (
	"encoding/json"
	"testing"
)

func TestRestaurantValidation(t *testing.T) {
	base := RestaurantInput{Name: "ร้านอาหาร", Currency: "THB", Visibility: "PRIVATE", VisitStatus: "WANT_TO_GO"}
	if e := base.validate(); e != nil {
		t.Fatal(e)
	}
	negative := -1.0
	fraction := 1.001
	lat := 91.0
	lng := 100.0
	min, max := 200.0, 100.0
	cases := []RestaurantInput{base, base, base, base, base}
	cases[0].PriceMin = &negative
	cases[1].PriceMin = &fraction
	cases[2].Latitude = &lat
	cases[2].Longitude = &lng
	cases[3].Latitude = &lng
	cases[4].PriceMin = &min
	cases[4].PriceMax = &max
	for _, in := range cases {
		if in.validate() == nil {
			t.Errorf("accepted invalid restaurant: %+v", in)
		}
	}
	for _, raw := range []string{"javascript:alert(1)", "https://www.google.com.evil.test/maps/embed", "http://www.google.com/maps/embed", "https://user@www.google.com/maps/embed", "https://www.google.com:443/maps/embed"} {
		if safeURL(&raw, true) {
			t.Errorf("accepted embed %s", raw)
		}
	}
	good := "https://www.google.com/maps/embed?pb=test"
	if !safeURL(&good, true) {
		t.Fatal("rejected allowlisted embed")
	}
}
func TestPatchProtectsFieldsAndClearsNullable(t *testing.T) {
	desc := "old"
	in := RestaurantInput{Name: "original", Description: &desc, Currency: "THB", Visibility: "PRIVATE", VisitStatus: "WANT_TO_GO"}
	for _, patch := range []map[string]json.RawMessage{{"user_id": json.RawMessage(`"owner"`)}, {"visibility": json.RawMessage(`null`)}, {"name": json.RawMessage(`42`)}} {
		if mergePatch(&in, patch) == nil {
			t.Fatal("invalid patch accepted")
		}
	}
	if e := mergePatch(&in, map[string]json.RawMessage{"description": json.RawMessage(`null`)}); e != nil || in.Description != nil || in.Name != "original" {
		t.Fatalf("patch merge failed: %v", e)
	}
}
func TestPaginationRejectsMalformedCursor(t *testing.T) {
	for _, tc := range []struct {
		limit  int
		cursor string
	}{{-1, ""}, {101, ""}, {20, "bad"}} {
		if _, _, e := page(tc.limit, tc.cursor); e == nil {
			t.Fatal("invalid pagination accepted")
		}
	}
}
