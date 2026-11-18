"use client"

import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Heart } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { qk } from "@/hooks/queries"
import { likeApi } from "@/lib/api/endpoints"
import type { RestaurantDetail } from "@/lib/api/types"
import { errorMessage, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"

export function LikeButton({ detail, className }: { detail: RestaurantDetail; className?: string }) {
  const qc = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const authed = useAuthStore((s) => s.status === "authenticated")
  const id = detail.restaurant.id
  const { liked, like_count } = detail

  const toggle = async () => {
    if (!authed) {
      toast.info(t.like.loginToLike)
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    const key = qk.restaurant(id)
    const previous = qc.getQueryData<RestaurantDetail>(key)
    qc.setQueryData<RestaurantDetail>(key, (d) => d && { ...d, liked: !liked, like_count: d.like_count + (liked ? -1 : 1) })
    try {
      const state = await likeApi.set(id, !liked)
      qc.setQueryData<RestaurantDetail>(key, (d) => d && { ...d, ...state })
      void qc.invalidateQueries({ queryKey: ["feed"] })
    } catch (e) {
      qc.setQueryData(key, previous)
      toast.error(errorMessage(e))
    }
  }

  return (
    <Button
      variant="outline"
      onClick={toggle}
      aria-pressed={liked}
      className={cn("bg-card", liked && "border-primary/40 text-primary", className)}
    >
      <Heart className={cn(liked && "fill-current")} />
      {liked ? t.like.liked : t.like.like} · {like_count}
    </Button>
  )
}
