import { z } from "zod"
import type { RestaurantCreate, RestaurantDetail, UserPreferences } from "@/lib/api/types"
import { t } from "@/lib/i18n"

const v = t.validation

const optionalText = (max: number) => z.string().max(max, v.max(max))

const optionalUrl = z
  .string()
  .max(2048)
  .refine((s) => {
    if (!s.trim()) return true
    try {
      const u = new URL(s.trim())
      return u.protocol === "https:" || u.protocol === "http:"
    } catch {
      return false
    }
  }, v.url)

// Same allowlist as the backend: HTTPS Google Maps embed URLs only.
const embedUrl = z
  .string()
  .max(2048)
  .refine((s) => {
    if (!s.trim()) return true
    try {
      const u = new URL(s.trim())
      return u.protocol === "https:" && ["www.google.com", "maps.google.com"].includes(u.host) && u.pathname.startsWith("/maps/embed")
    } catch {
      return false
    }
  }, v.embedUrl)

const price = z.string().refine((s) => !s.trim() || /^\d{1,10}(\.\d{1,2})?$/.test(s.trim()), v.number)

export const restaurantSchema = z
  .object({
    name: z.string().trim().min(1, v.required).max(200, v.max(200)),
    description: optionalText(10000),
    address: optionalText(2000),
    phone: optionalText(32),
    website_url: optionalUrl,
    map_url: optionalUrl,
    map_embed_url: embedUrl,
    location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    price_min: price,
    price_max: price,
    visit_status: z.enum(["WANT_TO_GO", "VISITED"]),
    visibility: z.enum(["PUBLIC", "PRIVATE"]),
    category_ids: z.array(z.string()).max(20),
    tag_ids: z.array(z.string()).max(20),
  })
  .refine((d) => !d.price_min.trim() || !d.price_max.trim() || Number(d.price_min) <= Number(d.price_max), {
    message: v.priceRange,
    path: ["price_max"],
  })

export type RestaurantFormValues = z.infer<typeof restaurantSchema>

const text = (s: string) => (s.trim() ? s.trim() : null)
const num = (s: string) => (s.trim() ? Number(s) : null)

export function toPayload(values: RestaurantFormValues): RestaurantCreate {
  return {
    name: values.name.trim(),
    description: text(values.description),
    address: text(values.address),
    phone: text(values.phone),
    website_url: text(values.website_url),
    map_url: text(values.map_url),
    map_embed_url: text(values.map_embed_url),
    latitude: values.location?.lat ?? null,
    longitude: values.location?.lng ?? null,
    price_min: num(values.price_min),
    price_max: num(values.price_max),
    currency: "THB",
    visit_status: values.visit_status,
    visibility: values.visibility,
    category_ids: values.category_ids,
    tag_ids: values.tag_ids,
  }
}

export function toFormValues(detail?: RestaurantDetail, prefs?: UserPreferences | null): RestaurantFormValues {
  const r = detail?.restaurant
  const s = (x?: string | null) => x ?? ""
  const n = (x?: number | null) => (x == null ? "" : String(x))
  return {
    name: s(r?.name),
    description: s(r?.description),
    address: s(r?.address),
    phone: s(r?.phone),
    website_url: s(r?.website_url),
    map_url: s(r?.map_url),
    map_embed_url: s(r?.map_embed_url),
    location: r?.latitude != null && r?.longitude != null ? { lat: r.latitude, lng: r.longitude } : null,
    price_min: n(r?.price_min),
    price_max: n(r?.price_max),
    visit_status: r?.visit_status ?? "WANT_TO_GO",
    visibility: r?.visibility ?? prefs?.default_visibility ?? "PRIVATE",
    category_ids: detail?.categories.map((c) => c.id) ?? [],
    tag_ids: detail?.tags.map((c) => c.id) ?? [],
  }
}
