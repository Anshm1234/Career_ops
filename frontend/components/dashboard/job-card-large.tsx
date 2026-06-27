"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, ExternalLink, Bookmark, BookmarkCheck, EyeOff, Clock, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RankedJob {
  id: string
  title: string
  company: string
  url: string
  location: string
  description: string
  source: string
  posted_at: string
  matched_keywords: string[]
  salary_inr_low: number | null
  salary_inr_high: number | null
  salary_note: string
  location_note: string
  role_note: string
  topsis_score: number
  topsis_rank: number
  dimension_scores?: {
    skill: number; salary: number; role: number
    location: number; seniority: number
  }
}

function scoreLabel(pct: number) {
  if (pct >= 80) return { text: "Strong fit",    cls: "text-foreground"         }
  if (pct >= 65) return { text: "Good match",    cls: "text-foreground/70"      }
  if (pct >= 50) return { text: "Decent match",  cls: "text-muted-foreground"   }
  return           { text: "Partial match",  cls: "text-muted-foreground/60" }
}

function formatSalary(low: number | null, high: number | null) {
  if (!low && !high) return null
  const fmt = (n: number) => {
    const l = n / 100_000
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`
  }
  if (low && high && Math.abs(high - low) > 10_000) return `${fmt(low)}–${fmt(high)}`
  if (low) return fmt(low)
  if (high) return fmt(high)
  return null
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
      <span className="font-mono text-xs font-medium text-muted-foreground">
        #{rank}
      </span>
    </div>
  )
}

export function JobCardLarge({
  job,
  onHide,
}: {
  job: RankedJob
  onHide?: (id: string) => void
}) {
  const router  = useRouter()
  const pct     = Math.round(job.topsis_score * 100)
  const label   = scoreLabel(pct)
  const salary  = formatSalary(job.salary_inr_low, job.salary_inr_high)
  const [saved, setSaved] = useState(false)

  const chips: { text: string; icon: React.ComponentType<{ className?: string }> }[] = [
    ...(job.location ? [{ text: job.location, icon: MapPin }] : []),
    { text: job.source, icon: Building2 },
  ]

  return (
    <article
      onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
      className="group relative flex cursor-pointer items-start gap-6 rounded-2xl border border-border bg-card p-7 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      {/* Left — company avatar + job info */}
      <div className="flex flex-1 flex-col gap-3 min-w-0">
        <div className="flex items-start gap-3">
          <RankBadge rank={job.topsis_rank} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-snug tracking-tight text-foreground">
              {job.title}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{job.company}</p>
          </div>
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(({ text, icon: Icon }) => (
            <span key={text} className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              <Icon className="size-3" />
              {text}
            </span>
          ))}
          {salary && (
            <span className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {salary}
            </span>
          )}
          {job.posted_at && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/50">
              <Clock className="size-3" />
              {job.posted_at}
            </span>
          )}
        </div>

        {/* Matched keywords */}
        {job.matched_keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.matched_keywords.slice(0, 5).map((k) => (
              <span key={k} className="rounded-md bg-primary/8 px-2 py-0.5 font-mono text-[11px] text-primary/70">
                {k}
              </span>
            ))}
            {job.matched_keywords.length > 5 && (
              <span className="font-mono text-[11px] text-muted-foreground/40">
                +{job.matched_keywords.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right — score panel */}
      <div className="flex shrink-0 flex-col items-end gap-3 self-stretch">
        {/* Score */}
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums leading-none tracking-tight text-foreground">
            {pct}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
            match
          </div>
          <div className={cn("mt-1 text-xs font-medium", label.cls)}>
            {label.text}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons — stopPropagation so they don't navigate */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSaved((s) => !s) }}
            aria-label={saved ? "Unsave" : "Save"}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary",
              saved && "border-primary/40 bg-primary/5 text-primary",
            )}
          >
            {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onHide?.(job.id) }}
            aria-label="Hide this job"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <EyeOff className="size-4" />
          </button>

          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
          >
            Apply
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </article>
  )
}
