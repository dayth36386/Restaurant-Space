import type { Metadata } from "next"
import { FeedView } from "@/features/feed/feed-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.nav.feed }

export default function Page() {
  return <FeedView />
}
