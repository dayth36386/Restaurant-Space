// Browser-facing API origin. Baked in at build time (NEXT_PUBLIC_*).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "")

export const API_BASE = `${API_URL}/api/v1`

// Map tiles. The OpenStreetMap default is for development only: its usage policy
// forbids production traffic, so set a provider (MapTiler, Stadia, Carto…) to deploy.
export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
export const MAP_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
