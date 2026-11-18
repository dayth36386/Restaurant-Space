import Link from "next/link"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-base font-bold tracking-tight", tone === "light" && "text-ink-foreground")}>
      <span className={cn("flex size-7 items-center justify-center rounded-lg", tone === "light" ? "bg-gold" : "bg-primary")} aria-hidden>
        <span className="flex size-3.5 items-center justify-center rounded-full border-2 border-primary-foreground">
          <span className="size-1 rounded-full bg-primary-foreground" />
        </span>
      </span>
      {t.app.name}
    </Link>
  )
}
