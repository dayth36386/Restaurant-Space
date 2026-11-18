import Link from "next/link"
import { Heart, MapPin, MessageCircle } from "lucide-react"
import { CoverPlaceholder } from "@/components/cover-placeholder"
import { Reveal } from "@/components/reveal"
import type { RestaurantCard } from "@/lib/api/types"
import { UserAvatar } from "@/components/user-avatar"
import { formatPrice, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const slots = ["md:col-span-2 md:row-span-2", "md:col-span-2", "", ""]

function SpotlightCard({ card, large }: { card: RestaurantCard; large: boolean }) {
  const r = card.restaurant
  const price = formatPrice(r.price_min, r.price_max)
  return (
    <Link
      href={`/restaurants/${r.id}`}
      className="group relative block size-full min-h-64 overflow-hidden rounded-[1.75rem] bg-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.cover_url}
          alt={r.name}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
        />
      ) : (
        <CoverPlaceholder name={r.name} className="absolute inset-0" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity group-hover:opacity-90" />
      <div className={cn("absolute inset-x-0 bottom-0 grid gap-2 p-5 text-white", large && "md:p-8")}>
        <div className="flex items-center gap-2">
          <UserAvatar
            name={card.author.display_name}
            src={card.author.avatar_url}
            className="size-7 ring-2 ring-white/40"
            initialClassName="text-xs"
          />
          <span className="truncate text-sm text-white/90">
            {t.chat.postedBy} <span className="font-semibold text-white">{card.author.display_name}</span>
          </span>
          {price && (
            <span className="ml-auto shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">{price}</span>
          )}
        </div>
        <h3 className={cn("line-clamp-2 font-bold tracking-tight", large ? "text-2xl md:text-4xl" : "text-xl")}>{r.name}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
          {r.address && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{r.address}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" /> {card.like_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" /> {card.comment_count}
          </span>
        </div>
      </div>
    </Link>
  )
}

/** Bento of the most-liked restaurants: one feature tile and three smaller ones. */
export function Spotlight({ cards }: { cards: RestaurantCard[] }) {
  const top = [...cards].sort((a, b) => b.like_count + b.comment_count - (a.like_count + a.comment_count)).slice(0, 4)
  if (top.length < 3) return null
  return (
    <div className="grid gap-4 md:h-[600px] md:grid-cols-4 md:grid-rows-2">
      {top.map((card, i) => (
        <Reveal key={card.restaurant.id} delay={i * 90} className={cn("h-full", slots[i], top.length === 3 && i === 2 && "md:col-span-2")}>
          <SpotlightCard card={card} large={i === 0} />
        </Reveal>
      ))}
    </div>
  )
}
