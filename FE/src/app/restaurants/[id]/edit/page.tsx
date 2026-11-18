import type { Metadata } from "next"
import { EditRestaurantView } from "@/features/restaurant/edit-restaurant-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.restaurant.editTitle }

export default function Page() {
  return <EditRestaurantView />
}
