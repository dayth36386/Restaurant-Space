"use client"

import { useEffect, useRef } from "react"
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormError } from "@/components/form-field"
import { Reveal } from "@/components/reveal"
import { Tilt } from "@/components/tilt"
import { RestaurantCard, RestaurantCardSkeleton } from "@/features/restaurant/restaurant-card"
import type { RestaurantCard as Card, RestaurantList } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"

const gridClass = "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6"

export function RestaurantGrid({
  query,
  empty,
  showVisibility,
  filter,
  tilt,
}: {
  query: UseInfiniteQueryResult<InfiniteData<RestaurantList>>
  empty: React.ReactNode
  showVisibility?: boolean
  filter?: (card: Card) => boolean
  /** Pointer-following 3D tilt and scroll reveal, for showcase pages. */
  tilt?: boolean
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const { data, isPending, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query

  // Infinite scroll: load the next cursor page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: "400px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isPending) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 6 }, (_, i) => (
          <RestaurantCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid justify-items-center gap-3">
        <FormError message={errorMessage(error)} />
        <Button variant="outline" onClick={() => void refetch()}>
          {t.common.retry}
        </Button>
      </div>
    )
  }

  const all = data.pages.flatMap((p) => p.items)
  const items = filter ? all.filter(filter) : all
  if (items.length === 0) return <>{empty}</>

  return (
    <div className="grid gap-8">
      <div className={gridClass}>
        {items.map((card, i) =>
          tilt ? (
            <Reveal key={card.restaurant.id} delay={(i % 3) * 80} className="h-full">
              <Tilt>
                <RestaurantCard card={card} showVisibility={showVisibility} />
              </Tilt>
            </Reveal>
          ) : (
            <RestaurantCard key={card.restaurant.id} card={card} showVisibility={showVisibility} />
          ),
        )}
      </div>
      <div ref={sentinel} className="flex justify-center text-sm text-muted-foreground">
        {isFetchingNextPage ? (
          <Loader2 className="size-5 animate-spin" />
        ) : hasNextPage ? (
          <Button variant="outline" onClick={() => void fetchNextPage()}>
            {t.feed.loadMore}
          </Button>
        ) : (
          items.length > 6 && t.feed.end
        )}
      </div>
    </div>
  )
}
