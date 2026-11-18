"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/stores/auth-store"

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

/** Client-side guard: the access token only exists in browser memory. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "guest") router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [status, router, pathname])

  if (status !== "authenticated") return <PageSpinner />
  return <>{children}</>
}

/** Send signed-in users away from login/register pages. */
export function GuestOnly({ children, redirectTo = "/feed" }: { children: React.ReactNode; redirectTo?: string }) {
  const status = useAuthStore((s) => s.status)
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") router.replace(redirectTo)
  }, [status, router, redirectTo])

  if (status === "loading") return <PageSpinner />
  return <>{children}</>
}
