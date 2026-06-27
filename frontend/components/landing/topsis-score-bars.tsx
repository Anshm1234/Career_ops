import { cn } from "@/lib/utils"

const DIMS = [
  { label: "Skill match",  pct: 88 },
  { label: "Salary fit",   pct: 72 },
  { label: "Role match",   pct: 95 },
  { label: "Location",     pct: 60 },
  { label: "Seniority",    pct: 78 },
]

interface TopsisScoreBarsProps {
  className?: string
  dims?: { label: string; pct: number }[]
  animate?: boolean
  barColor?: string
}

export function TopsisScoreBars({ className, dims = DIMS, animate = true, barColor = "bg-foreground" }: TopsisScoreBarsProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {dims.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {d.label}
          </span>
          <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                barColor,
                animate && "transition-all duration-700 ease-out",
              )}
              style={{ width: `${d.pct}%` }}
            />
          </div>
          <span className="w-7 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {d.pct}
          </span>
        </div>
      ))}
    </div>
  )
}
