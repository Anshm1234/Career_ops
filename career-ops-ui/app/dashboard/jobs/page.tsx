"use client"

import { useEffect, useState } from "react"
import { FadeUpWords } from "@/components/animated-text"
import { JobCardFull } from "@/components/dashboard/job-card-full"
import { apiGet } from "@/lib/api"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

interface RankedJob {
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
  dimension_scores: {
    skill: number
    salary: number
    role: number
    location: number
    seniority: number
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<RankedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchJobs() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || localStorage.getItem("career_ops_user_id")

        if (!userId) {
          setError("No resume uploaded yet. Upload your resume from the dashboard first.")
          setLoading(false)
          return
        }

        const res = await apiGet(`/api/jobs/search/${userId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || "Failed to fetch jobs")
        }
        const data = await res.json()
        setJobs(data.jobs)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchJobs()
  }, [])

  const applied = jobs.filter((j) => j.topsis_score > 0.8).length
  const queued  = jobs.filter((j) => j.topsis_score > 0.6 && j.topsis_score <= 0.8).length
  const review  = jobs.filter((j) => j.topsis_score <= 0.6).length

  const SUMMARY = [
    { label: "Matched roles", value: jobs.length },
    { label: "High match",    value: applied },
    { label: "Good match",    value: queued },
    { label: "Low match",     value: review },
  ]

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="mb-2 font-mono text-sm text-primary">{"// ranked by TOPSIS engine"}</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          <FadeUpWords text="Your top matches" />
        </h1>
        <p className="mt-2 text-muted-foreground">
          Sourced from 40+ portals, filtered by keyword, role, location and salary — then ranked.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading your matches...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SUMMARY.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground text-sm">
              No matches found yet. Try uploading your resume again with different preferences.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.map((job, i) => (
                <JobCardFull key={job.id} job={job} rank={i + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}