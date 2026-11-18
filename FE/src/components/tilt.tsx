"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"

/** Subtle 3D tilt that follows the pointer (mouse/pen only; touch and reduced motion stay flat). */
export function Tilt({ children, className, max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reset = () => ref.current?.style.setProperty("transform", "")
  return (
    <div className="[perspective:1000px]">
      <div
        ref={ref}
        className={cn("h-full transition-transform duration-200 ease-out will-change-transform motion-reduce:transform-none!", className)}
        onPointerMove={(e) => {
          if (e.pointerType === "touch" || !ref.current) return
          const r = ref.current.getBoundingClientRect()
          const x = (e.clientX - r.left) / r.width - 0.5
          const y = (e.clientY - r.top) / r.height - 0.5
          ref.current.style.transform = `rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`
        }}
        onPointerLeave={reset}
      >
        {children}
      </div>
    </div>
  )
}
