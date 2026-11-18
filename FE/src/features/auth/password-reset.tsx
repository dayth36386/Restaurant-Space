"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { toast } from "sonner"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FormError } from "@/components/form-field"
import { AuthCard } from "@/features/auth/auth-card"
import { forgotSchema, resetSchema } from "@/features/auth/schemas"
import { authApi } from "@/lib/api/endpoints"
import { errorMessage, t } from "@/lib/i18n"
import { sessionHint, useAuthStore } from "@/stores/auth-store"

const backToLogin = (
  <Link href="/login" className="font-medium text-primary hover:underline">
    {t.auth.backToLogin}
  </Link>
)

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthCard title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle} footer={backToLogin}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center text-sm">
          <CheckCircle2 className="size-8 text-success" />
          <p>{t.auth.forgotSent}</p>
        </div>
      ) : (
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
          <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />} {t.auth.forgotSubmit}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null)
    try {
      await authApi.resetPassword(token, password)
      // Reset revokes every session, including this browser's.
      useAuthStore.getState().clearSession()
      sessionHint.set(false)
      toast.success(t.auth.resetDone)
      router.replace("/login")
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  if (token.length !== 43) {
    return (
      <AuthCard title={t.auth.resetTitle} footer={backToLogin}>
        <FormError message={t.auth.resetMissingToken} />
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t.auth.resetTitle} footer={backToLogin}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormError message={error} />
        <Field label={t.auth.newPassword} htmlFor="password" error={errors.password?.message} hint={t.validation.passwordMin}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
        </Field>
        <Field label={t.auth.confirmPassword} htmlFor="confirm" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.confirm}
            {...form.register("confirm")}
          />
        </Field>
        <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} {t.auth.resetSubmit}
        </Button>
      </form>
    </AuthCard>
  )
}
