import { z } from "zod"
import { t } from "@/lib/i18n"

const v = t.validation

export const passwordSchema = z.string().min(10, v.passwordMin).max(72, v.passwordMax)

export const loginSchema = z.object({
  email: z.email(v.email),
  password: z.string().min(1, v.required),
})

export const registerSchema = z.object({
  display_name: z.string().trim().min(1, v.required).max(100, v.max(100)),
  username: z.string().regex(/^[a-z0-9_]{3,50}$/, v.username),
  email: z.email(v.email).max(254),
  password: passwordSchema,
})

export const forgotSchema = z.object({ email: z.email(v.email) })

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: v.passwordMismatch, path: ["confirm"] })
