"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/layout/logo"
import { pageClass } from "@/components/page-header"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function SiteFooter() {
  // Full-height app screens have no room for a footer.
  if (usePathname().startsWith("/chat")) return null
  const link = "text-ink-foreground/85 transition-colors hover:text-ink-foreground"
  return (
    <footer className={cn(pageClass, "mt-20 pb-6")}>
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-hero px-8 py-10 text-ink-foreground md:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="grid max-w-xs gap-3">
            <Logo tone="light" />
            <p className="text-sm text-ink-foreground/85">{t.app.tagline}</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-14 gap-y-3 text-sm sm:grid-cols-3">
            <Link href="/feed" className={link}>
              {t.nav.feed}
            </Link>
            <Link href="/map" className={link}>
              {t.nav.map}
            </Link>
            <Link href="/restaurants" className={link}>
              {t.nav.mine}
            </Link>
            <Link href="/chat" className={link}>
              {t.nav.chat}
            </Link>
            <Link href="/settings" className={link}>
              {t.nav.settings}
            </Link>
          </nav>
        </div>
        <div className="mt-10 border-t border-white/20 pt-5 text-xs text-ink-foreground/70">
          © {t.app.name} · แผนที่ © OpenStreetMap contributors
        </div>
      </div>
    </footer>
  )
}
