"use client"

import Link from "next/link"
import { Bookmark, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader, pageClass } from "@/components/page-header"
import { RequireAuth } from "@/components/require-auth"
import { SearchInput, StatusChips } from "@/features/feed/filters"
import { RestaurantGrid } from "@/features/restaurant/restaurant-grid"
import { useRestaurants } from "@/hooks/queries"
import { useUrlState } from "@/hooks/use-url-state"
import type { VisitStatus } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function MyRestaurants() {
  const [filters, setFilters] = useUrlState(["q", "status"] as const)
  const query = useRestaurants({
    mine: true,
    q: filters.q || undefined,
    visit_status: (filters.status as VisitStatus) || undefined,
  })

  return (
    <div className={cn(pageClass, "grid gap-6 py-8 md:py-12")}>
      <PageHeader
        title={t.mine.title}
        subtitle={t.mine.subtitle}
        actions={
          <Button asChild size="lg">
            <Link href="/restaurants/new">
              <Plus /> {t.nav.add}
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} className="w-full sm:max-w-md" />
        <StatusChips value={filters.status} onChange={(status) => setFilters({ status })} />
      </div>
      <RestaurantGrid
        query={query}
        showVisibility
        empty={
          <EmptyState
            icon={Bookmark}
            title={t.mine.empty}
            action={
              <Button asChild>
                <Link href="/restaurants/new">
                  <Plus /> {t.mine.emptyCta}
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  )
}

export function MyRestaurantsView() {
  return (
    <RequireAuth>
      <MyRestaurants />
    </RequireAuth>
  )
}
