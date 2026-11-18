import { Sparkle } from "lucide-react"
import type { RestaurantCard } from "@/lib/api/types"

/** Endless strip of restaurant names; the list is doubled so the loop is seamless. */
export function NameMarquee({ cards }: { cards: RestaurantCard[] }) {
  const names = [...new Set(cards.map((c) => c.restaurant.name))].slice(0, 12)
  if (names.length < 3) return null
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden}>
      {names.map((name, i) => (
        <li key={name + i} className="flex items-center gap-8 text-3xl font-bold tracking-tight whitespace-nowrap md:text-5xl">
          <span className={i % 2 ? "text-outline text-primary/50" : "text-foreground"}>{name}</span>
          <Sparkle className="size-6 shrink-0 fill-gold text-gold md:size-8" />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] py-2">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
