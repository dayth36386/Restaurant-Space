"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { FormError } from "@/components/form-field"
import { AuthCard } from "@/features/auth/auth-card"
import { authApi } from "@/lib/api/endpoints"
import type { Tokens } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

// The authorization code is single-use; share one exchange across StrictMode re-mounts.
const exchanges = new Map<string, Promise<Tokens>>()

/**
 * Landing page for GOOGLE_REDIRECT_URL. Forwards state/code to the API, which
 * validates them against its oauth_state cookie and sets the refresh cookie.
 */
export function GoogleCallback() {
  const router = useRouter()
  const params = useSearchParams()
  const [exchangeError, setError] = useState<string | null>(null)
  const state = params.get("state") ?? ""
  const code = params.get("code") ?? ""
  const error = !state || !code ? t.auth.googleFailed : exchangeError

  useEffect(() => {
    if (!state || !code) return
    let exchange = exchanges.get(code)
    if (!exchange) {
      exchange = authApi.googleCallback(state, code)
      exchanges.set(code, exchange)
    }
    exchange
      .then((tokens) => {
        useAuthStore.getState().setSession(tokens)
        router.replace("/feed")
      })
      .catch((e) => setError(errorMessage(e)))
  }, [state, code, router])

  return (
    <AuthCard title={error ? t.auth.googleFailed : t.auth.googleSigningIn}>
      {error ? (
        <div className="grid gap-4 text-center text-sm">
          <FormError message={error} />
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t.auth.backToLogin}
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
    </AuthCard>
  )
}
