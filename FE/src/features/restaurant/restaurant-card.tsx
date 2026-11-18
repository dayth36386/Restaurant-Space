import Link from "next/link"
import { ArrowUpRight, Check, Heart, Lock, MapPin, MessageCircle, Star } from "lucide-react"
import { CoverPlaceholder } from "@/components/cover-placeholder"
import { Skeleton } from "@/components/ui/skeleton"
import { UserAvatar } from "@/components/user-avatar"
import type { RestaurantCard as Card } from "@/lib/api/types"
import { formatPrice, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function RestaurantCard({ card, showVisibility }: { card: Card; showVisibility?: boolean }) {
  const r = card.restaurant
  const price = formatPrice(r.price_min, r.price_max)
  const visited = r.visit_status === "VISITED"

  return (
    <Link
      href={`/restaurants/${r.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm shadow-foreground/[0.03] transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative m-2 aspect-[16/11] overflow-hidden rounded-[1.1rem] bg-sage">
        {card.cover_url ? (
          // Presigned MinIO/S3 URLs change every few minutes; skip next/image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.cover_url}
            alt={r.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <CoverPlaceholder name={r.name} />
        )}
        {card.cover_url && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md",
              visited ? "bg-primary/90 text-primary-foreground" : "bg-white/85 text-foreground",
            )}
          >
            {visited ? <Check className="size-3" /> : <Star className="size-3" />}
            {t.restaurant.visitStatus[r.visit_status]}
          </span>
          {showVisibility && r.visibility === "PRIVATE" && (
            <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Lock className="size-3" /> {t.restaurant.visibility.PRIVATE}
            </span>
          )}
        </div>
        {price && (
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-foreground shadow-sm backdrop-blur-md">
            {price}
          </span>
        )}
        <span className="absolute right-3 bottom-3 flex size-9 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 pt-2 pb-4">
        <h3 className="line-clamp-1 text-[17px] font-bold tracking-tight">{r.name}</h3>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{r.address || t.restaurant.noLocation}</span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs font-medium text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={card.author.display_name} src={card.author.avatar_url} className="size-6" initialClassName="text-[10px]" />
            <span className="truncate">
              {t.chat.postedBy} <span className="font-semibold text-foreground">{card.author.display_name}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1" title={t.restaurant.likes}>
              <Heart className="size-3.5" /> {card.like_count}
            </span>
            <span className="flex items-center gap-1" title={t.restaurant.comments}>
              <MessageCircle className="size-3.5" /> {card.comment_count}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}

export function RestaurantCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-card">
      <Skeleton className="m-2 aspect-[16/11] rounded-[1.1rem]" />
      <div className="grid gap-2 px-4 pt-2 pb-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-2 h-3 w-16" />
      </div>
    </div>
  )
}
