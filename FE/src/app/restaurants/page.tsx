import type { Metadata } from "next"
import { MyRestaurantsView } from "@/features/restaurant/my-restaurants-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.nav.mine }

export default function Page() {
  return <MyRestaurantsView />
}
