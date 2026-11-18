"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/** Read/write filter values in the query string so lists are shareable and survive reloads. */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>

  const set = useCallback(
    (patch: Partial<Record<K, string>>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )

  return [values, set] as const
}
