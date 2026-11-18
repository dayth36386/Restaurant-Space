import type { Metadata } from "next"
import { RegisterForm } from "@/features/auth/register-form"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.nav.register }

export default function Page() {
  return <RegisterForm />
}
