"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageHeader, pageClass } from "@/components/page-header"
import { RequireAuth } from "@/components/require-auth"
import { RestaurantForm } from "@/features/restaurant/restaurant-form"
import { restaurantApi, uploadApi } from "@/lib/api/endpoints"
import type { RestaurantCreate } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const r = t.restaurant

export function NewRestaurantView() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const create = async (payload: RestaurantCreate, photos: File[]) => {
    const restaurant = await restaurantApi.create(payload)
    if (photos.length) {
      const toastId = toast.loading(r.uploadingPhotos(0, photos.length))
      for (const [i, file] of photos.entries()) {
        try {
          const { media } = await uploadApi.image(file)
          await restaurantApi.attachImage(restaurant.id, { media_id: media.id, sort_order: i, is_cover: i === 0 })
        } catch (e) {
          toast.error(`${r.photoFailed(file.name)}: ${errorMessage(e)}`)
        }
        toast.loading(r.uploadingPhotos(i + 1, photos.length), { id: toastId })
      }
      toast.dismiss(toastId)
    }
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["restaurants"] }), queryClient.invalidateQueries({ queryKey: ["feed"] })])
    toast.success(r.created)
    router.replace(`/restaurants/${restaurant.id}`)
  }

  return (
    <RequireAuth>
      <div className={cn(pageClass, "grid gap-6 py-8 md:py-12")}>
        <PageHeader title={r.newTitle} subtitle={r.newSubtitle} />
        <RestaurantForm withPhotos submitLabel={r.create} onSubmit={create} onCancel={() => router.back()} />
      </div>
    </RequireAuth>
  )
}
