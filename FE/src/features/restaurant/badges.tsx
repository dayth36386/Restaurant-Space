import { Check, Globe, Lock, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Visibility, VisitStatus } from "@/lib/api/types"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function VisitBadge({ status, className }: { status: VisitStatus; className?: string }) {
  const visited = status === "VISITED"
  return (
    <Badge className={cn(visited ? "bg-success/15 text-success" : "bg-accent text-accent-foreground", "border-transparent", className)}>
      {visited ? <Check /> : <Star />}
      {t.restaurant.visitStatus[status]}
    </Badge>
  )
}

export function VisibilityBadge({ visibility, className }: { visibility: Visibility; className?: string }) {
  const isPublic = visibility === "PUBLIC"
  return (
    <Badge variant="outline" className={cn("bg-background/90 backdrop-blur", className)}>
      {isPublic ? <Globe /> : <Lock />}
      {t.restaurant.visibility[visibility]}
    </Badge>
  )
}
