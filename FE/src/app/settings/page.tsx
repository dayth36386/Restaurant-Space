import type { Metadata } from "next"
import { SettingsView } from "@/features/profile/settings-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.settings.title }

export default function Page() {
  return <SettingsView />
}
