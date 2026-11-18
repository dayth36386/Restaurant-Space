import { th, type Messages } from "./th"

const locale = "th-TH"

/** Current UI messages. Swap per locale once English copy exists. */
export function useT(): Messages {
  return th
}

export const t = th

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code)
    if (th.errors[code]) return th.errors[code]
    if ("message" in error && typeof error.message === "string" && error.message) return error.message
  }
  if (error instanceof TypeError) return th.errors.network
  return th.errors.generic
}

const thb = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })

export function formatPrice(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? `฿${thb.format(min)}` : `฿${thb.format(min)}–${thb.format(max)}`
  if (min != null) return `฿${thb.format(min)}+`
  return `≤ ฿${thb.format(max!)}`
}

export function formatBaht(value?: number | null): string | null {
  return value == null ? null : `฿${thb.format(value)}`
}

export function formatDate(iso?: string): string {
  if (!iso) return ""
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso))
}

const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", … then a short date after a week. */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 45) return "เมื่อสักครู่"
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour")
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), "day")
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso))
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}
