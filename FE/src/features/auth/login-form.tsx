"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Field, FormError } from "@/components/form-field"
import { GuestOnly } from "@/components/require-auth"
import { AuthSplit, GoogleIcon } from "@/features/auth/auth-card"
import { loginSchema } from "@/features/auth/schemas"
import { authApi } from "@/lib/api/endpoints"
import { API_BASE } from "@/lib/config"
import { errorMessage, t } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/feed"
}

export function GoogleButton() {
  return (
    <Button asChild size="lg" variant="outline" className="h-11 w-full bg-card">
      <a href={`${API_BASE}/auth/google`}>
        <GoogleIcon />
        {t.auth.google}
      </a>
    </Button>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <Separator className="flex-1" /> {t.auth.orEmail} <Separator className="flex-1" />
    </div>
  )
}

export function LoginForm() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const tokens = await authApi.login(values)
      useAuthStore.getState().setSession(tokens)
      router.replace(next)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <GuestOnly redirectTo={next}>
      <AuthSplit
        title={t.auth.loginTitle}
        subtitle={t.auth.loginSubtitle}
        cardTitle={t.auth.loginCardTitle}
        footer={
          <>
            {t.auth.noAccount}{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              {t.nav.register}
            </Link>
          </>
        }
      >
        <div className="grid gap-5">
          <GoogleButton />
          <OrDivider />
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormError message={error} />
            <Field label={t.auth.email} htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-11"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
            </Field>
            <Field label={t.auth.password} htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
            </Field>
            <div className="-mt-1 text-right">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                {t.auth.forgot}
              </Link>
            </div>
            <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} {t.auth.submitLogin}
            </Button>
          </form>
        </div>
      </AuthSplit>
    </GuestOnly>
  )
}
