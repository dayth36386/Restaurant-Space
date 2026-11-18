"use client"

import Link from "next/link"
import { ArrowRight, MapPinned } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RestaurantsMap } from "@/features/map"
import type { RestaurantCard } from "@/lib/api/types"
import { t } from "@/lib/i18n"

export function MapTeaser({ cards }: { cards: RestaurantCard[] }) {
  const pins = cards
    .filter((c) => c.restaurant.latitude != null && c.restaurant.longitude != null)
    .map((c) => ({
      id: c.restaurant.id,
      name: c.restaurant.name,
      address: c.restaurant.address,
      lat: c.restaurant.latitude!,
      lng: c.restaurant.longitude!,
      coverUrl: c.cover_url,
      priceMin: c.restaurant.price_min,
      priceMax: c.restaurant.price_max,
      own: true,
    }))
  if (pins.length === 0) return null
  return (
    <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-xl shadow-primary/5 md:grid-cols-[1fr_1.4fr]">
      <div className="grid content-center gap-5 p-8 md:p-12">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 text-primary-foreground shadow-lg shadow-primary/30">
          <MapPinned className="size-6" />
        </span>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t.feed.mapTitle}</h2>
        <p className="max-w-sm text-muted-foreground">{t.feed.mapBody}</p>
        <p className="text-sm font-semibold text-primary">{t.feed.pinned(pins.length)}</p>
        <Button asChild size="lg" className="w-fit rounded-full">
          <Link href="/map?scope=public">
            {t.feed.mapCta} <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="relative h-80 md:h-auto md:min-h-[420px]">
        <RestaurantsMap pins={pins} scrollZoom={false} />
      </div>
    </div>
  )
}
