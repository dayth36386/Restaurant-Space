import type { Metadata } from "next"
import { NewRestaurantView } from "@/features/restaurant/new-restaurant-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.restaurant.newTitle }

export default function Page() {
  return <NewRestaurantView />
}
