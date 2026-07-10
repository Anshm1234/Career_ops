"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, ExternalLink, MapPin, Building2,
  Clock, Bookmark, BookmarkCheck, AlertCircle,
  FileText, Download, Loader2, ChevronDown, ChevronUp,
} from "lucide-react"
import { apiGet, apiPost } from "@/lib/api"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type { RankedJob } from "@/components/dashboard/job-card-large"

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const DIMS = [
  { key: "skill",     label: "Skill match"  },
  { key: "salary",    label: "Salary fit"   },
  { key: "role",      label: "Role match"   },
  { key: "location",  label: "Location"     },
  { key: "seniority", label: "Seniority"    },
] as const

function scoreLabel(pct: number): { text: string; cls: string } {
  if (pct >= 80) return { text: "Strong fit",   cls: "text-foreground"        }
  if (pct >= 65) return { text: "Good match",   cls: "text-foreground/70"     }
  if (pct >= 50) return { text: "Decent match", cls: "text-muted-foreground"  }
  return               { text: "Partial match", cls: "text-muted-foreground/60"}
}

function formatSalary(low: number | null, high: number | null): string | null {
  if (!low && !high) return null
  const fmt = (n: number) => {
    const l = n / 100_000
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`
  }
  if (low && high && Math.abs(high - low) > 10_000) return `${fmt(low)} – ${fmt(high)}`
  return low ? fmt(low) : high ? fmt(high) : null
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/* ─── sub-components ──────────────────────────────────────────────────────── */

function ScoreBars({ scores }: { scores: NonNullable<RankedJob["dimension_scores"]> }) {
  return (
    <div className="space-y-3">
      {DIMS.map(({ key, label }) => {
        const val = Math.round((scores[key] ?? 0) * 100)
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">{label}</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${val}%` }} />
            </div>
            <span className="w-8 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {val}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CompanyAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const letters = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center rounded-xl border border-border bg-secondary font-mono font-semibold",
      size === "lg" ? "size-14 text-lg" : "size-10 text-sm",
    )}>
      {letters}
    </div>
  )
}

/* ─── page ────────────────────────────────────────────────────────────────── */

type TailorState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; latex: string; gaps: string[]; disclaimer: string }
  | { status: "error"; message: string }
  | { status: "limited" }

export default function JobDetailPage() {
  const params       = useParams<{ jobId: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [job,     setJob]     = useState<RankedJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [savedRowId, setSavedRowId] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  const [tailor,      setTailor]      = useState<TailorState>({ status: "idle" })
  const [compiling,   setCompiling]   = useState(false)
  const [showLatex,   setShowLatex]   = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const demoUser = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
          ? process.env.NEXT_PUBLIC_DEMO_USER_ID : null
        const userId = user?.id || demoUser
        if (!userId) { setError("Not authenticated"); setLoading(false); return }

        const res = await apiGet(`/api/jobs/search/${userId}`)
        if (!res.ok) throw new Error("Failed to load matches")
        const data = await res.json()
        const found = (data.jobs as RankedJob[]).find(j => j.id === params.jobId)
        if (!found) { setError("Job not found in your matches."); setLoading(false); return }
        setJob(found)

        // Restore saved state — is this job already in the tracker?
        if (user) {
          const { data: rows } = await supabase
            .from("applications")
            .select("id")
            .eq("user_id", user.id)
            .eq("job_id", params.jobId)
            .limit(1)
          if (rows && rows.length > 0) {
            setSaved(true)
            setSavedRowId(rows[0].id)
          }
        }
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
        setLoading(false)
      }
    }
    load()
  }, [params.jobId])

  // Save/unsave — persists to the applications table (status "saved") so the
  // job shows up in the Tracker; unsaving removes the row.
  const handleToggleSave = useCallback(async () => {
    if (!job || saving) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return   // demo mode / no session — nothing to persist

    setSaving(true)
    try {
      if (saved && savedRowId) {
        setSaved(false)
        await supabase
          .from("applications")
          .delete()
          .eq("id", savedRowId)
          .eq("user_id", user.id)
        setSavedRowId(null)
      } else {
        setSaved(true)   // optimistic
        const { data, error } = await supabase
          .from("applications")
          .insert({
            user_id:      user.id,
            job_id:       job.id,
            company:      job.company,
            role:         job.title,
            url:          job.url,
            source:       job.source ?? null,
            topsis_score: job.topsis_score ?? null,
            topsis_rank:  job.topsis_rank ?? null,
            status:       "saved",
            applied_at:   new Date().toISOString(),
          })
          .select("id")
          .single()
        if (error) setSaved(false)   // roll back optimistic state
        else       setSavedRowId(data.id)
      }
    } finally {
      setSaving(false)
    }
  }, [job, saved, savedRowId, saving])

  const handleTailor = useCallback(async () => {
    setTailor({ status: "loading" })
    try {
      const res = await apiPost("/api/resume/tailor", { job_id: params.jobId })
      if (res.status === 429) {
        setTailor({ status: "limited" })
        return
      }
      if (!res.ok) {
        const d = await res.json()
        setTailor({ status: "error", message: d.detail || "Tailoring failed." })
        return
      }
      const d = await res.json()
      setTailor({
        status: "done",
        latex: d.tailored_latex,
        gaps: d.gaps ?? [],
        disclaimer: d.disclaimer ?? "",
      })
    } catch {
      setTailor({ status: "error", message: "Network error — please try again." })
    }
  }, [params.jobId])

  // Auto-trigger if navigated from card with ?tailor=1
  useEffect(() => {
    if (searchParams.get("tailor") === "1" && tailor.status === "idle" && job) {
      handleTailor()
    }
  }, [job, searchParams, tailor.status, handleTailor])

  const handleCompile = useCallback(async (latex: string) => {
    setCompiling(true)
    try {
      const res = await apiPost("/api/resume/compile", { latex })
      if (res.ok) {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement("a")
        a.href     = url
        a.download = "resume_tailored.pdf"
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // Compile failed — fall through to .tex download
        const d = await res.json()
        alert(d.detail + "\n\nUse the Download .tex button to get the file and compile on Overleaf.")
      }
    } catch {
      alert("PDF compile unavailable. Use the Download .tex button instead.")
    } finally {
      setCompiling(false)
    }
  }, [])

  const downloadTex = useCallback((latex: string) => {
    const blob = new Blob([latex], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = "resume_tailored.tex"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="animate-pulse font-mono text-sm text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="px-8 py-12">
        <button type="button" onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error || "Job not found."}
        </div>
      </div>
    )
  }

  const pct    = Math.round(job.topsis_score * 100)
  const label  = scoreLabel(pct)
  const salary = formatSalary(job.salary_inr_low, job.salary_inr_high)
  const desc   = job.description ? cleanDescription(job.description) : null

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/80 px-8 py-4 backdrop-blur-sm">
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to matches
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="truncate text-sm font-medium">{job.title}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{job.company}</span>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 gap-0">

        {/* LEFT — main content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* Job header */}
          <div className="mb-8 flex items-start gap-5">
            <CompanyAvatar name={job.company} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-snug tracking-tight">{job.title}</h1>
              <p className="mt-1 text-base text-muted-foreground">{job.company}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {job.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />{job.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5" />{job.source}
                </span>
                {job.posted_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />{job.posted_at}
                  </span>
                )}
                {salary && <span className="font-mono">{salary}</span>}
              </div>
            </div>
          </div>

          {/* Matched keywords */}
          {job.matched_keywords?.length > 0 && (
            <div className="mb-8">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Matched keywords
              </p>
              <div className="flex flex-wrap gap-2">
                {job.matched_keywords.map(k => (
                  <span key={k} className="rounded-lg bg-secondary px-3 py-1 font-mono text-xs text-foreground/70">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tailor result panel */}
          {tailor.status !== "idle" && (
            <div className="mb-8">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Tailored resume
              </p>

              {tailor.status === "loading" && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>Aligning resume to job description — this takes 15–30 seconds…</span>
                </div>
              )}

              {tailor.status === "limited" && (
                <div className="rounded-xl border border-border bg-card px-6 py-5 text-sm text-muted-foreground">
                  Daily tailoring limit reached (3/day). Come back tomorrow.
                </div>
              )}

              {tailor.status === "error" && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {tailor.message}
                </div>
              )}

              {tailor.status === "done" && (
                <div className="flex flex-col gap-4">
                  {/* Download actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => tailor.status === "done" && handleCompile(tailor.latex)}
                      disabled={compiling}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      {compiling
                        ? <><Loader2 className="size-3.5 animate-spin" /> Compiling PDF…</>
                        : <><Download className="size-3.5" /> Download PDF</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => tailor.status === "done" && downloadTex(tailor.latex)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-3.5" /> Download .tex
                    </button>
                    <a
                      href="https://www.overleaf.com/project"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-2 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    >
                      <ExternalLink className="size-3" /> Open in Overleaf
                    </a>
                  </div>

                  {/* Gaps list */}
                  {tailor.gaps.length > 0 && (
                    <div className="rounded-xl border border-border bg-secondary/40 px-5 py-4">
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Gaps — requirements not in your resume
                      </p>
                      <ul className="space-y-1">
                        {tailor.gaps.map((g, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 shrink-0 font-mono text-muted-foreground/40">–</span>
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="flex items-start gap-2 rounded-xl border border-dashed border-border px-4 py-3">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                    <p className="text-xs text-muted-foreground">{tailor.disclaimer}</p>
                  </div>

                  {/* LaTeX preview toggle */}
                  <button
                    type="button"
                    onClick={() => setShowLatex(s => !s)}
                    className="flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                  >
                    {showLatex ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {showLatex ? "Hide" : "Preview"} LaTeX source
                  </button>
                  {showLatex && (
                    <pre className="max-h-80 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {tailor.latex}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Job description
              </p>
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground">
                View full posting <ExternalLink className="size-3" />
              </a>
            </div>

            {desc ? (
              <>
                <p className="whitespace-pre-wrap text-sm leading-[1.8] text-foreground/80">{desc}</p>
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">
                    Description may be truncated.{" "}
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-foreground">
                      View the full posting
                    </a>{" "}
                    before applying.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-secondary/30 px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No description stored.{" "}
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground">
                    View the full posting →
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — sticky score panel */}
        <div className="w-80 shrink-0 border-l border-border">
          <div className="sticky top-[61px] flex flex-col gap-6 p-6">

            {/* Match score */}
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="text-6xl font-bold tabular-nums leading-none tracking-tight">
                {pct}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                match score
              </div>
              <div className={cn("mt-2 text-sm font-medium", label.cls)}>
                {label.text}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground/40">
                #{job.topsis_rank} ranked
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <a
                href={job.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                Apply / View posting <ExternalLink className="size-3.5" />
              </a>
              <button
                type="button"
                onClick={handleToggleSave}
                disabled={saving}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary disabled:opacity-60",
                  saved && "border-primary/40 bg-primary/5 text-primary",
                )}
              >
                {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                {saved ? "Saved to tracker" : "Save job"}
              </button>
              <button
                type="button"
                onClick={handleTailor}
                disabled={tailor.status === "loading" || tailor.status === "limited"}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm transition-colors hover:bg-secondary",
                  tailor.status === "loading" && "cursor-wait opacity-60",
                  tailor.status === "limited" && "cursor-not-allowed opacity-40",
                )}
              >
                {tailor.status === "loading"
                  ? <><Loader2 className="size-4 animate-spin" /> Tailoring…</>
                  : <><FileText className="size-4" /> Tailor resume</>}
              </button>
            </div>

            {/* TOPSIS breakdown */}
            {job.dimension_scores && (
              <div>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Why this is a match
                </p>
                <ScoreBars scores={job.dimension_scores} />
              </div>
            )}

            {/* Company */}
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Company
              </p>
              <div className="flex items-center gap-3">
                <CompanyAvatar name={job.company} />
                <div>
                  <p className="text-sm font-medium">{job.company}</p>
                  <a href={job.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                    Open roles <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
