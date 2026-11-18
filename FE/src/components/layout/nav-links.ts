import { t } from "@/lib/i18n"

export const navLinks = [
  { href: "/feed", label: t.nav.feed, auth: false },
  { href: "/restaurants", label: t.nav.mine, auth: true },
  { href: "/map", label: t.nav.map, auth: false },
  { href: "/chat", label: t.nav.chat, auth: true },
] as const

export function isActive(pathname: string, href: string) {
  if (href === "/restaurants") return pathname === "/restaurants"
  if (href === "/feed") return pathname === "/" || pathname.startsWith("/feed")
  return pathname === href || pathname.startsWith(`${href}/`)
}
