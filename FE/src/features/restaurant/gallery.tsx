"use client"

import { useState } from "react"
import { Images } from "lucide-react"
import { CoverPlaceholder } from "@/components/cover-placeholder"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { ImageWithURL } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Mosaic slots for 1–4+ photos: one large cover with up to three tiles beside it.
const layouts: Record<number, string[]> = {
  1: ["col-span-4 row-span-2"],
  2: ["col-span-3 row-span-2", "col-span-1 row-span-2"],
  3: ["col-span-2 row-span-2", "col-span-2 row-span-1", "col-span-2 row-span-1"],
  4: ["col-span-2 row-span-2", "col-span-1 row-span-1", "col-span-1 row-span-1", "col-span-2 row-span-1"],
}

function Img({ im, alt, className }: { im: ImageWithURL; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={im.url} alt={im.image.alt_text || alt} className={cn("size-full object-cover", className)} />
}

export function Gallery({ images, name }: { images: ImageWithURL[]; name: string }) {
  const [open, setOpen] = useState(false)
  // Cover first, then the owner's order.
  const ordered = [...images].sort((a, b) => Number(b.image.is_cover) - Number(a.image.is_cover) || a.image.sort_order - b.image.sort_order)

  if (ordered.length === 0) {
    return (
      <div className="aspect-[16/6] overflow-hidden rounded-3xl">
        <CoverPlaceholder name={name} />
      </div>
    )
  }

  const shown = ordered.slice(0, 4)
  const slots = layouts[shown.length]

  return (
    <div className="relative">
      <div className="aspect-[4/3] overflow-hidden rounded-3xl md:hidden">
        <Img im={ordered[0]} alt={name} />
      </div>
      <div className="hidden h-[480px] grid-cols-4 grid-rows-2 gap-3 overflow-hidden rounded-3xl md:grid">
        {shown.map((im, i) => (
          <button
            key={im.image.id}
            type="button"
            onClick={() => setOpen(true)}
            className={cn("overflow-hidden rounded-lg bg-sage", slots[i])}
          >
            <Img im={im} alt={name} className="transition-transform duration-500 hover:scale-[1.02]" />
          </button>
        ))}
      </div>
      {ordered.length > 1 && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-4 bottom-4 rounded-full glass shadow-lg"
          onClick={() => setOpen(true)}
        >
          <Images /> {t.restaurant.allPhotos(ordered.length)}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle>{name}</DialogTitle>
          <div className="grid gap-3">
            {ordered.map((im) => (
              <div key={im.image.id} className="overflow-hidden rounded-lg">
                <Img im={im} alt={name} className="h-auto" />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
