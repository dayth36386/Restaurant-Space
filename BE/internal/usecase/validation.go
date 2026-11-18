package usecase

import (
	"math"
	"net/url"
	"strings"

	"restaurant-space/api/internal/domain"
)

type RestaurantInput struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Address     *string  `json:"address"`
	Phone       *string  `json:"phone"`
	WebsiteURL  *string  `json:"website_url"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	MapURL      *string  `json:"map_url"`
	MapEmbedURL *string  `json:"map_embed_url"`
	PriceMin    *float64 `json:"price_min"`
	PriceMax    *float64 `json:"price_max"`
	Currency    string   `json:"currency"`
	VisitStatus string   `json:"visit_status"`
	Visibility  string   `json:"visibility"`
	CategoryIDs []string `json:"category_ids"`
	TagIDs      []string `json:"tag_ids"`
}

func money(v *float64) bool {
	return v == nil || (!math.IsNaN(*v) && !math.IsInf(*v, 0) && *v >= 0 && *v <= 9999999999.99 && math.Abs(*v*100-math.Round(*v*100)) < 0.0001)
}
func textLimit(v *string, n int) bool { return v == nil || len([]rune(*v)) <= n }
func safeURL(v *string, embed bool) bool {
	if v == nil || *v == "" {
		return true
	}
	u, e := url.Parse(*v)
	if e != nil || len(*v) > 2048 || u.Host == "" || u.User != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return false
	}
	return !embed || (u.Scheme == "https" && (u.Host == "www.google.com" || u.Host == "maps.google.com") && strings.HasPrefix(u.Path, "/maps/embed"))
}
func (in *RestaurantInput) validate() error {
	in.Name = strings.TrimSpace(in.Name)
	if len([]rune(in.Name)) < 1 || len([]rune(in.Name)) > 200 || !textLimit(in.Description, 10000) || !textLimit(in.Address, 2000) || !textLimit(in.Phone, 32) {
		return bad("Invalid restaurant text fields")
	}
	if (in.Latitude == nil) != (in.Longitude == nil) {
		return bad("Provide both latitude and longitude")
	}
	if in.Latitude != nil && (*in.Latitude < -90 || *in.Latitude > 90 || *in.Longitude < -180 || *in.Longitude > 180) {
		return bad("Invalid coordinates")
	}
	if !money(in.PriceMin) || !money(in.PriceMax) || (in.PriceMin != nil && in.PriceMax != nil && *in.PriceMin > *in.PriceMax) {
		return bad("Invalid price range")
	}
	if in.Currency != "THB" {
		return bad("Only THB is supported")
	}
	if in.Visibility != "PRIVATE" && in.Visibility != "PUBLIC" {
		return bad("Invalid visibility")
	}
	if in.VisitStatus != "WANT_TO_GO" && in.VisitStatus != "VISITED" {
		return bad("Invalid visit_status")
	}
	if !safeURL(in.WebsiteURL, false) || !safeURL(in.MapURL, false) || !safeURL(in.MapEmbedURL, true) {
		return bad("Invalid URL or map embed provider")
	}
	for _, ids := range [][]string{in.CategoryIDs, in.TagIDs} {
		if len(ids) > 20 {
			return bad("Too many categories or tags")
		}
		seen := map[string]bool{}
		for _, id := range ids {
			if !validID(id) || seen[id] {
				return bad("Invalid or duplicate taxonomy ID")
			}
			seen[id] = true
		}
	}
	return nil
}
func (in RestaurantInput) model() domain.Restaurant {
	return domain.Restaurant{Name: in.Name, Description: in.Description, Address: in.Address, Phone: in.Phone, WebsiteURL: in.WebsiteURL, Latitude: in.Latitude, Longitude: in.Longitude, MapURL: in.MapURL, MapEmbedURL: in.MapEmbedURL, PriceMin: in.PriceMin, PriceMax: in.PriceMax, Currency: in.Currency, VisitStatus: in.VisitStatus, Visibility: in.Visibility}
}
