export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-[30px] leading-tight font-bold tracking-tight md:text-[40px]">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Page width and gutters shared by the design's desktop frames. */
export const pageClass = "mx-auto w-full max-w-7xl px-4 md:px-8"
