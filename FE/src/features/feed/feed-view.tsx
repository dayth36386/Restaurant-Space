"use client"

import { SearchX, UtensilsCrossed } from "lucide-react"
import { Chips } from "@/components/chips"
import { EmptyState } from "@/components/empty-state"
import { pageClass } from "@/components/page-header"
import { Reveal } from "@/components/reveal"
import { FeedHero } from "@/features/feed/feed-hero"
import { SearchInput } from "@/features/feed/filters"
import { MapTeaser } from "@/features/feed/map-teaser"
import { NameMarquee } from "@/features/feed/marquee"
import { Spotlight } from "@/features/feed/spotlight"
import { RestaurantGrid } from "@/features/restaurant/restaurant-grid"
import { useCategories, useFeed } from "@/hooks/queries"
import { useUrlState } from "@/hooks/use-url-state"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function SectionTitle({ title, subtitle, children, id }: { title: string; subtitle?: string; children?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1.5">
        <h2 className="text-3xl font-bold tracking-tight md:text-[44px] md:leading-tight">{title}</h2>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function FeedView() {
  const [filters, setFilters] = useUrlState(["q", "category_id"] as const)
  const { data: categories = [] } = useCategories()
  const query = useFeed({ q: filters.q || undefined, category_id: filters.category_id || undefined })
  // Unfiltered first page drives the showcase sections; it shares the cache with the grid when not searching.
  const showcase = useFeed({})
  const searching = !!(filters.q || filters.category_id)
  const cards = showcase.data?.pages[0]?.items ?? []

  const categoryChips = categories.length > 0 && (
    <Chips
      value={filters.category_id}
      onChange={(category_id) => setFilters({ category_id })}
      options={[{ value: "", label: t.feed.allCategories }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
    />
  )

  if (searching) {
    return (
      <div className={cn(pageClass, "grid gap-8 py-8 md:py-12")}>
        <SectionTitle title={t.feed.results} subtitle={filters.q ? `“${filters.q}”` : undefined}>
          {categoryChips}
        </SectionTitle>
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} className="max-w-xl" inputClassName="h-13 text-base" />
        <RestaurantGrid query={query} empty={<EmptyState icon={SearchX} title={t.feed.emptySearch} />} />
      </div>
    )
  }

  return (
    <div className="grid gap-20 pt-4 pb-8 md:gap-28">
      <FeedHero q={filters.q} onSearch={(q) => setFilters({ q })} cards={cards} hasMore={!!showcase.data?.pages[0]?.next_cursor} />

      <NameMarquee cards={cards} />

      {cards.length >= 3 && (
        <section className={cn(pageClass, "grid gap-8")}>
          <Reveal>
            <SectionTitle id="spotlight" title={t.feed.spotlight} subtitle={t.feed.spotlightSub} />
          </Reveal>
          <Spotlight cards={cards} />
        </section>
      )}

      <Reveal as="section" className={pageClass}>
        <MapTeaser cards={cards} />
      </Reveal>

      <section className={cn(pageClass, "grid gap-8")}>
        <Reveal>
          <SectionTitle id={cards.length >= 3 ? undefined : "spotlight"} title={t.feed.latest} subtitle={t.feed.latestSub}>
            {categoryChips}
          </SectionTitle>
        </Reveal>
        <RestaurantGrid query={query} tilt empty={<EmptyState icon={UtensilsCrossed} title={t.feed.empty} />} />
      </section>
    </div>
  )
}
