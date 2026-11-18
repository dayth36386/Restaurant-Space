"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowDown, Heart, Sparkles } from "lucide-react"
import { CoverPlaceholder } from "@/components/cover-placeholder"
import { HeroScene } from "@/components/three"
import { SearchInput } from "@/features/feed/filters"
import type { RestaurantCard } from "@/lib/api/types"
import { formatPrice, t } from "@/lib/i18n"

const WEEK_MS = 7 * 86_400_000

export function FeedHero({
  q,
  onSearch,
  cards,
  hasMore,
}: {
  q: string
  onSearch: (q: string) => void
  cards: RestaurantCard[]
  hasMore: boolean
}) {
  const [now] = useState(() => Date.now())
  const top = [...cards].sort((a, b) => b.like_count - a.like_count)[0]
  // The feed is newest-first, so the first page covers the past week unless it is full.
  const fresh = cards.filter((c) => now - new Date(c.restaurant.created_at).getTime() < WEEK_MS).length
  const freshLabel = fresh === cards.length && hasMore ? `${fresh}+` : String(fresh)

  return (
    <section className="relative isolate mx-3 overflow-hidden rounded-[2.5rem] bg-hero text-ink-foreground md:mx-6">
      <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px] opacity-[0.06]" />

      {/* The scene spans the right two-thirds behind the copy on desktop. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[56%] [mask-image:linear-gradient(to_right,transparent_8%,black_38%)] lg:block">
        <HeroScene />
      </div>

      <div className="mx-auto grid min-h-[min(calc(100svh-6rem),820px)] max-w-7xl content-between gap-10 px-6 pt-14 pb-8 sm:px-10 md:px-14 md:pt-20">
        <div className="grid max-w-2xl gap-7">
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-ink-foreground backdrop-blur">
            <Sparkles className="size-3.5" /> {t.feed.eyebrow}
          </span>
          {/* Each line stays whole: Thai has no spaces, so the browser would split mid-phrase. */}
          <h1 className="text-[38px] leading-[1.05] font-bold tracking-tight whitespace-nowrap sm:text-[60px] lg:text-[84px]">
            {t.feed.heroLine1}
            <br />
            <span className="text-hero-accent">{t.feed.heroLine2}</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-foreground/85 md:text-lg">{t.feed.heroBody}</p>
          <SearchInput
            value={q}
            onChange={onSearch}
            className="max-w-lg"
            inputClassName="h-15 border-white/10 bg-white pl-12 dark:bg-white text-base text-foreground shadow-2xl shadow-black/30 placeholder:text-muted-foreground"
          />
        </div>

        <div className="-mx-6 h-72 sm:-mx-10 sm:h-96 lg:hidden">
          <HeroScene />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <a href="#spotlight" className="group flex items-center gap-3 text-sm text-ink-foreground/85 hover:text-ink-foreground">
            <span className="flex size-10 items-center justify-center rounded-full border border-white/30 transition-colors group-hover:border-white group-hover:bg-white/10">
              <ArrowDown className="size-4 animate-bounce" />
            </span>
            {t.feed.scroll}
          </a>
          <div className="flex flex-wrap items-end gap-3">
            {cards.length > 0 && (
              <span className="animate-float rounded-2xl border-white/15 glass bg-white/10 px-4 py-3 text-sm text-ink-foreground backdrop-blur-xl">
                <span className="block text-hero-accent text-2xl font-bold">{freshLabel}</span>
                {t.feed.newThisWeek}
              </span>
            )}
            {top && (
              <Link
                href={`/restaurants/${top.restaurant.id}`}
                className="flex w-72 animate-float items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2.5 pr-4 backdrop-blur-xl transition-colors [animation-delay:-3s] hover:bg-white/15"
              >
                <span className="size-16 shrink-0 overflow-hidden rounded-xl">
                  {top.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={top.cover_url} alt="" className="size-full object-cover" />
                  ) : (
                    <CoverPlaceholder name={top.restaurant.name} />
                  )}
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-[11px] font-semibold tracking-wide text-ink-foreground/80 uppercase">{t.feed.topPick}</span>
                  <span className="truncate font-semibold">{top.restaurant.name}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-foreground/80">
                    <span className="flex items-center gap-1">
                      <Heart className="size-3 fill-current text-peach" /> {top.like_count}
                    </span>
                    {formatPrice(top.restaurant.price_min, top.restaurant.price_max)}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
