import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card/70 px-6 py-16 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sage to-peach/70 text-primary shadow-inner">
        <Icon className="size-7" />
      </span>
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
