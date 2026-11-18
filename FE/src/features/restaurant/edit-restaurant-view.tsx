"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, SearchX } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/empty-state"
import { PageHeader, pageClass } from "@/components/page-header"
import { PageSpinner, RequireAuth } from "@/components/require-auth"
import { ImageManager } from "@/features/restaurant/image-manager"
import { MenuManager } from "@/features/restaurant/menu-manager"
import { FormCard, RestaurantForm } from "@/features/restaurant/restaurant-form"
import { qk, useRestaurant } from "@/hooks/queries"
import { restaurantApi } from "@/lib/api/endpoints"
import type { RestaurantCreate } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

const r = t.restaurant

function EditRestaurant() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const { data, isPending, isError } = useRestaurant(id)

  if (isPending) return <PageSpinner />
  if (isError || data.restaurant.user_id !== userId) {
    return (
      <div className={cn(pageClass, "max-w-3xl py-10")}>
        <EmptyState icon={SearchX} title={r.notFound} />
      </div>
    )
  }

  const save = async (payload: RestaurantCreate) => {
    await restaurantApi.update(id, payload)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.restaurant(id) }),
      queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
    ])
    toast.success(r.saved)
    router.push(`/restaurants/${id}`)
  }

  return (
    <div className={cn(pageClass, "grid gap-6 py-8 md:py-12")}>
      <Link href={`/restaurants/${id}`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {data.restaurant.name}
      </Link>
      <PageHeader title={r.editTitle} subtitle={r.editSubtitle} />
      <RestaurantForm
        initial={data}
        submitLabel={r.saveChanges}
        onSubmit={save}
        onCancel={() => router.push(`/restaurants/${id}`)}
        aside={
          <FormCard title={r.photosCard}>
            <ImageManager detail={data} />
          </FormCard>
        }
      />
      <FormCard id="menu" title={r.menu}>
        <MenuManager detail={data} />
      </FormCard>
    </div>
  )
}

export function EditRestaurantView() {
  return (
    <RequireAuth>
      <EditRestaurant />
    </RequireAuth>
  )
}
