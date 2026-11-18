"use client"

import { Check } from "lucide-react"
import type { Taxonomy } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function TaxonomyPicker({ items, value, onChange }: { items: Taxonomy[]; value: string[]; onChange: (v: string[]) => void }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{t.restaurant.noTaxonomy}</p>
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id].slice(0, 20))
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = value.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(item.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted",
              selected && "border-primary bg-accent text-accent-foreground hover:bg-accent",
            )}
          >
            {selected && <Check className="size-3.5" />}
            {item.name}
          </button>
        )
      })}
    </div>
  )
}
