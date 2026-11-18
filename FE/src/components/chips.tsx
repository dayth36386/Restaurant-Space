"use client"

import { cn } from "@/lib/utils"

/** Single-select pill filters: active is filled primary, others are outlined. */
export function Chips({
  value,
  onChange,
  options,
  className,
  tone = "card",
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
  tone?: "card" | "sage"
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value || "all"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-full px-4 text-sm transition-all",
              active
                ? "bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/25"
                : tone === "sage"
                  ? "bg-sage text-foreground hover:bg-sage/70"
                  : "border bg-card text-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
