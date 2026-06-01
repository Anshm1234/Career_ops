"use client"

import { useState } from "react"
import { Banknote, BookOpen, MapPin, Sparkles, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface RankedJob {
  id: string
  title: string
  company: string
  url: string
  location: string
  source: string
  posted_at: string
  matched_keywords: string[]
  salary_inr_low: number | null
  salary_inr_high: number | null
  salary_note: string
  topsis_score: number
  topsis_rank: number
  dimension_scores?: {
    skill: number
    salary: number
    role: number
    location: number
    seniority: number
  }
}

const DIMENSIONS = [
  { key: "skill",     label: "Skill" },
  { key: "salary",    label: "Salary" },
  { key: "role",      label: "Role" },
  { key: "location",  label: "Location" },
  { key: "seniority", label: "Seniority" },
] as const

function formatSalary(low: number | null, high: number | null, note: string): string {
  if (!low && !high) return "No salary listed"
  const fmt = (n: number) => {
    const l = n / 100_000
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`
  }
  if (low && high && Math.abs(high - low) > 10_000) return `${fmt(low)}–${fmt(high)}`
  if (low) return fmt(low)
  if (high) return fmt(high)
  return "No salary listed"
}

export function JobCardFull({ job, rank }: { job: RankedJob; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.round(job.topsis_score * 100)

  const scoreColor =
    pct >= 80 ? "text-primary" :
    pct >= 60 ? "text-muted-foreground" :
    "text-muted-foreground/60"

  return (
    <article className={cn(
      "group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200",
      "hover:border-primary/30",
    )}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-mono text-sm text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-foreground">{job.title}</h3>
          <p className="text-sm text-muted-foreground">
            {job.company} · <span className="font-mono text-xs">{job.source}</span>
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          {job.location || "Location not listed"}
        </span>
        <span className="flex items-center gap-1.5">
          <Banknote className="size-3.5" />
          {formatSalary(job.salary_inr_low, job.salary_inr_high, job.salary_note)}
        </span>
      </div>

      {/* Keywords */}
      {job.matched_keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.matched_keywords.slice(0, 6).map((k) => (
            <span key={k} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {k}
            </span>
          ))}
        </div>
      )}

      {/* TOPSIS score */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">TOPSIS match</span>
          <span className={cn("font-mono font-medium", scoreColor)}>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Dimension breakdown */}
      {expanded && job.dimension_scores && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Dimension scores
          </p>
          <div className="space-y-2">
            {DIMENSIONS.map(({ key, label }) => {
              const val = job.dimension_scores![key] ?? 0
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-foreground">{Math.round(val * 100)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${val * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 flex-1 text-xs" asChild>
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5 mr-1.5" />
            Apply now
          </a>
        </Button>
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs bg-transparent">
          <Sparkles className="size-3.5" />
          Tailor resume
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs bg-transparent"
          onClick={() => setExpanded((e) => !e)}
          aria-label="Toggle dimension scores"
        >
          <BookOpen className="size-3.5" />
        </Button>
      </div>
    </article>
  )
}
