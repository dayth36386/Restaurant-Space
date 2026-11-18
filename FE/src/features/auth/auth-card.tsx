"use client"

import { Logo } from "@/components/layout/logo"
import { pageClass } from "@/components/page-header"
import { HeroScene } from "@/components/three"
import { cn } from "@/lib/utils"

/** Centered card for secondary auth flows (forgot/reset password, OAuth callback). */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 md:py-20">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="rounded-3xl border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">{children}</div>
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}

/** Login/register layout: brand panel with the 3D scene beside the form card. */
export function AuthSplit({
  title,
  subtitle,
  cardTitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  cardTitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className={cn(pageClass, "py-6 md:py-10")}>
      <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-2xl shadow-primary/10 md:grid-cols-[1.1fr_1fr]">
        <div className="relative isolate hidden min-h-[560px] flex-col justify-between overflow-hidden bg-hero p-10 text-ink-foreground md:flex">
          <div className="absolute inset-x-0 top-16 bottom-28 -z-10">
            <HeroScene />
          </div>
          <Logo tone="light" />
          <div className="grid gap-2">
            <h1 className="text-3xl leading-tight font-bold tracking-tight">{title}</h1>
            <p className="max-w-sm text-sm text-ink-foreground/85">{subtitle}</p>
          </div>
        </div>
        <div className="grid content-center gap-6 p-6 sm:p-10 md:p-12">
          <div className="relative -mx-6 -mt-6 h-44 overflow-hidden bg-hero sm:-mx-10 sm:-mt-10 md:hidden">
            <HeroScene />
          </div>
          <div className="grid gap-1 md:hidden">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <h2 className="hidden text-2xl font-bold tracking-tight md:block">{cardTitle}</h2>
          {children}
          {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
