import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name,
  src,
  className,
  initialClassName,
}: {
  name: string
  src?: string | null
  className?: string
  initialClassName?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <Avatar className={cn("size-8", className)}>
      {src ? <AvatarImage src={src} alt={name} className="object-cover" /> : null}
      <AvatarFallback className={cn("bg-peach font-semibold text-foreground", initialClassName)}>{initial}</AvatarFallback>
    </Avatar>
  )
}
