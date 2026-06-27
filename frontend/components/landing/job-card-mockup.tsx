import { MapPin, Building2, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

const DIMS = [
  { label: "Skill",     pct: 88 },
  { label: "Salary",    pct: 74 },
  { label: "Role",      pct: 92 },
  { label: "Location",  pct: 65 },
  { label: "Seniority", pct: 80 },
]

interface JobCardMockupProps {
  className?: string
}

/**
 * A styled static sample job card shown in the hero.
 * Includes a TOPSIS match badge and 5-dimension score bars.
 */
export function JobCardMockup({ className }: JobCardMockupProps) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/20",
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ashby · full-time
          </p>
          <h3 className="mt-1 text-base font-semibold leading-snug tracking-tight">
            Machine Learning Engineer
          </h3>
        </div>
        {/* TOPSIS match badge */}
        <div className="shrink-0 rounded-lg border border-border bg-secondary px-2.5 py-1 text-center">
          <div className="text-lg font-semibold tabular-nums leading-none">87</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            match
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building2 className="size-3" />
          Perplexity AI
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3" />
          San Francisco / Remote
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="size-3" />
          ₹28L – ₹42L
        </span>
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-border" />

      {/* Score bars */}
      <div className="space-y-2">
        {DIMS.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {d.label}
            </span>
            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <span className="w-6 text-right font-mono text-[10px] text-muted-foreground">
              {d.pct}
            </span>
          </div>
        ))}
      </div>

      {/* Keywords */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["Python", "PyTorch", "LLMs", "MLOps"].map((k) => (
          <span
            key={k}
            className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground"
          >
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}
