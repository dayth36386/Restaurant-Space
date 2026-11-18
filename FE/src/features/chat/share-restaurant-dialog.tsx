"use client"

import { useState } from "react"
import { ImageOff, Loader2, Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useFeed } from "@/hooks/queries"
import type { RestaurantCard } from "@/lib/api/types"
import { formatPrice, t } from "@/lib/i18n"

/** Only public restaurants can be shared, so search the public feed. */
export function ShareRestaurantDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onPick: (card: RestaurantCard) => void
}) {
  const [q, setQ] = useState("")
  const feed = useFeed({ q: q.trim() || undefined, limit: 20 })
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.chat.shareTitle}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.chat.shareSearch} className="h-11 pl-9" autoFocus />
        </div>
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {feed.isPending ? (
            <li className="flex justify-center p-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </li>
          ) : items.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">{t.chat.shareEmpty}</li>
          ) : (
            items.map((card) => (
              <li key={card.restaurant.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(card)
                    onOpenChange(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sage text-primary/50">
                    {card.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.cover_url} alt="" className="size-full object-cover" />
                    ) : (
                      <ImageOff className="size-4" />
                    )}
                  </span>
                  <span className="grid min-w-0">
                    <span className="truncate text-sm font-semibold">{card.restaurant.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[card.restaurant.address, formatPrice(card.restaurant.price_min, card.restaurant.price_max)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
