import type { Metadata } from "next"
import { EditProfileView } from "@/features/profile/edit-profile-view"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.profile.editTitle }

export default function Page() {
  return <EditProfileView />
}
