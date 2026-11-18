"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Chips } from "@/components/chips"
import { useCategories } from "@/hooks/queries"
import type { VisitStatus } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function SearchInput({
  value,
  onChange,
  className,
  inputClassName,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  inputClassName?: string
}) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)

  // Follow external changes (back/forward navigation) without an effect.
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onChange(draft.trim().slice(0, 100)), 350)
    return () => clearTimeout(id)
  }, [draft, value, onChange])

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t.feed.search}
        className={cn(
          "h-11 rounded-full border-border bg-card pr-10 pl-10 shadow-xs [&::-webkit-search-cancel-button]:appearance-none",
          inputClassName,
        )}
        maxLength={100}
        aria-label={t.feed.search}
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("")
            onChange("")
          }}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="ล้างคำค้นหา"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

const ALL = "all"

export function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: categories = [] } = useCategories()
  if (categories.length === 0) return null
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="h-10! min-w-40 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t.feed.allCategories}</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const statusOptions: { value: "" | VisitStatus; label: string }[] = [
  { value: "", label: t.mine.all },
  { value: "WANT_TO_GO", label: t.restaurant.visitStatus.WANT_TO_GO },
  { value: "VISITED", label: t.restaurant.visitStatus.VISITED },
]

export function StatusChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Chips value={value} onChange={onChange} options={statusOptions} />
}
