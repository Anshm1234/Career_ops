import { Banknote, MapPin } from "lucide-react"
import type { RankedJob } from "@/lib/jobs-data"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<RankedJob["status"], string> = {
  applied: "border-primary/40 bg-primary/10 text-primary",
  queued: "border-accent/40 bg-accent/10 text-accent",
  review: "border-border bg-secondary text-muted-foreground",
}

const STATUS_LABEL: Record<RankedJob["status"], string> = {
  applied: "Applied",
  queued: "Queued",
  review: "Needs review",
}

export function JobCard({ job, rank }: { job: RankedJob; rank: number }) {
  const pct = Math.round(job.score * 100)
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-mono text-sm text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-foreground">{job.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {job.company} · <span className="font-mono text-xs">{job.source}</span>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            STATUS_STYLES[job.status],
          )}
        >
          {STATUS_LABEL[job.status]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          {job.location}
        </span>
        <span className="flex items-center gap-1.5">
          <Banknote className="size-3.5" />
          {job.salary}
        </span>
        <span className="font-mono text-xs">{job.posted}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.keywords.map((k) => (
          <span key={k} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            {k}
          </span>
        ))}
      </div>

      {/* Match score */}
      <div className="mt-1">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">TOPSIS match</span>
          <span className="font-mono font-medium text-primary">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </article>
  )
}
