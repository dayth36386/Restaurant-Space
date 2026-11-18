import type { Metadata } from "next"
import { ResetPasswordForm } from "@/features/auth/password-reset"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.auth.resetTitle }

export default function Page() {
  return <ResetPasswordForm />
}
