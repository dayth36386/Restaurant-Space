import type { Metadata } from "next"
import { LoginForm } from "@/features/auth/login-form"
import { t } from "@/lib/i18n"

export const metadata: Metadata = { title: t.nav.login }

export default function Page() {
  return <LoginForm />
}
