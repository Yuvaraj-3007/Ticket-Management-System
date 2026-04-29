import * as React from "react"

import { cn } from "@/lib/utils"

type SkeletonProps = {
  className?: string
  width?: string | number
  height?: string | number
  circle?: boolean
  lines?: number
} & React.HTMLAttributes<HTMLDivElement>

export function Skeleton({
  className,
  width,
  height,
  circle = false,
  lines = 1,
  ...props
}: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 bg-muted rounded-md animate-pulse",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    )
  }

  const style: React.CSSProperties = {}
  if (width !== undefined)
    style.width = typeof width === "number" ? `${width}px` : width
  if (height !== undefined)
    style.height = typeof height === "number" ? `${height}px` : height

  return (
    <div
      role="status"
      className={cn(
        "bg-muted/50 animate-pulse",
        circle ? "rounded-full" : "rounded-md",
        className
      )}
      style={style}
      {...props}
    />
  )
}

export default Skeleton
