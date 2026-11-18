import type { Metadata } from "next"
import { MapView } from "@/features/map/map-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.map.title }

export default function Page() {
  return <MapView />
}
