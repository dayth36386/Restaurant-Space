"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FormError } from "@/components/form-field"
import { GuestOnly } from "@/components/require-auth"
import { AuthSplit } from "@/features/auth/auth-card"
import { GoogleButton, OrDivider } from "@/features/auth/login-form"
import { registerSchema } from "@/features/auth/schemas"
import { authApi } from "@/lib/api/endpoints"
import { errorMessage, t } from "@/lib/i18n"
import { useAuthStore } from "@/stores/auth-store"

type Values = z.infer<typeof registerSchema>

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", username: "", email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const tokens = await authApi.register(values)
      useAuthStore.getState().setSession(tokens)
      router.replace("/restaurants")
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  const fields: { name: keyof Values; label: string; type: string; autoComplete: string; hint?: string }[] = [
    { name: "display_name", label: t.auth.displayName, type: "text", autoComplete: "name" },
    { name: "username", label: t.auth.username, type: "text", autoComplete: "username", hint: t.auth.usernameHint },
    { name: "email", label: t.auth.email, type: "email", autoComplete: "email" },
    { name: "password", label: t.auth.password, type: "password", autoComplete: "new-password", hint: t.validation.passwordMin },
  ]

  return (
    <GuestOnly redirectTo="/restaurants">
      <AuthSplit
        title={t.auth.registerTitle}
        subtitle={t.auth.registerSubtitle}
        cardTitle={t.auth.registerCardTitle}
        footer={
          <>
            {t.auth.haveAccount}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t.nav.login}
            </Link>
          </>
        }
      >
        <div className="grid gap-5">
          <GoogleButton />
          <OrDivider />
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormError message={error} />
            {fields.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={f.name} error={errors[f.name]?.message} hint={f.hint}>
                <Input
                  id={f.name}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  className="h-11"
                  aria-invalid={!!errors[f.name]}
                  {...form.register(f.name, f.name === "username" ? { setValueAs: (v: string) => v.toLowerCase() } : undefined)}
                />
              </Field>
            ))}
            <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} {t.auth.submitRegister}
            </Button>
          </form>
        </div>
      </AuthSplit>
    </GuestOnly>
  )
}
