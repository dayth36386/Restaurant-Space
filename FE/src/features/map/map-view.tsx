"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Loader2, MapPin } from "lucide-react"
import { Chips } from "@/components/chips"
import { PageHeader, pageClass } from "@/components/page-header"
import { RestaurantsMap, type MapPin as Pin } from "@/features/map"
import { useFeed, useRestaurants } from "@/hooks/queries"
import { useUrlState } from "@/hooks/use-url-state"
import type { RestaurantCard } from "@/lib/api/types"
import { formatPrice, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

// One page of up to 100 (the API maximum) keeps the map responsive.
const MAP_LIMIT = 100

function toPins(cards: RestaurantCard[], userId?: string): Pin[] {
  return cards
    .filter(({ restaurant: r }) => r.latitude != null && r.longitude != null)
    .map(({ restaurant: r, cover_url }) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      lat: r.latitude!,
      lng: r.longitude!,
      coverUrl: cover_url,
      priceMin: r.price_min,
      priceMax: r.price_max,
      own: r.user_id === userId,
    }))
}

export function MapView() {
  const { status, user } = useAuthStore()
  const authed = status === "authenticated"
  const [{ scope }, setUrl] = useUrlState(["scope"] as const)
  const showMine = authed && scope !== "public"

  const mine = useRestaurants({ mine: true, limit: MAP_LIMIT }, showMine)
  const feed = useFeed({ limit: MAP_LIMIT })
  const active = showMine ? mine : feed

  const pins = useMemo(() => toPins(active.data?.pages.flatMap((p) => p.items) ?? [], user?.id), [active.data, user?.id])

  return (
    <div className={cn(pageClass, "grid gap-6 py-8 md:py-12")}>
      <PageHeader
        title={t.map.title}
        subtitle={t.map.subtitle}
        actions={
          authed && (
            <Chips
              value={showMine ? "" : "public"}
              onChange={(s) => setUrl({ scope: s })}
              options={[
                { value: "", label: t.map.mine },
                { value: "public", label: t.map.public },
              ]}
            />
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[60dvh] min-h-[420px] overflow-hidden rounded-3xl bg-sage shadow-sm ring-1 ring-border lg:h-[620px]">
          <RestaurantsMap pins={pins} />
          {active.isPending && (
            <div className="absolute top-3 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-card px-3 py-1.5 shadow">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>
        <aside className="flex max-h-[620px] min-h-0 flex-col rounded-3xl border bg-card shadow-sm">
          <div className="grid gap-0.5 p-5 pb-3">
            <h2 className="font-semibold">{t.map.nearby}</h2>
            <p className="text-xs text-muted-foreground">{t.map.pinned(pins.length)}</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {pins.map((p) => (
              <li key={p.id}>
                <Link href={`/restaurants/${p.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-sage">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.address, formatPrice(p.priceMin, p.priceMax)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {!active.isPending && pins.length === 0 && (
              <li className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                <MapPin className="size-5" /> {t.map.noPins}
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}
