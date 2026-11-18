import { UtensilsCrossed } from "lucide-react"
import { cn } from "@/lib/utils"

// Deterministic tone per name so neighbouring placeholders differ.
const tones = [
  "from-primary via-primary-2 to-gold",
  "from-gold via-primary to-primary-2",
  "from-primary-2 via-primary to-gold",
  "from-primary-2 via-primary-2/80 to-gold",
]

/** Branded stand-in for a missing cover photo: rich gradient, pattern and the name's initial. */
export function CoverPlaceholder({ name, className }: { name: string; className?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?"
  const tone = tones[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % tones.length]
  return (
    <div
      className={cn("relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br", tone, className)}
      aria-hidden
    >
      <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px] opacity-[0.12]" />
      <span className="absolute -top-10 -right-10 size-40 rounded-full bg-white/15 blur-2xl" />
      <span className="relative text-6xl font-bold text-white/90 drop-shadow-sm">{letter}</span>
      <UtensilsCrossed className="absolute right-4 bottom-4 size-5 text-white/50" />
    </div>
  )
}
