"use client"

import { useCallback, useEffect, useState } from "react"
import { FadeUpWords } from "@/components/animated-text"
import { JobCardLarge, type RankedJob } from "@/components/dashboard/job-card-large"
import { apiGet } from "@/lib/api"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function JobsPage() {
  const PAGE_SIZE = 50

  const [jobs,    setJobs]    = useState<RankedJob[]>([])
  const [hidden,  setHidden]  = useState<Set<string>>(new Set())
  const [shown,   setShown]   = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function fetchJobs() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const demoUser = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
          ? process.env.NEXT_PUBLIC_DEMO_USER_ID : null
        const userId = user?.id || demoUser

        if (!userId) {
          setError("No resume uploaded yet. Complete onboarding to see your matches.")
          setLoading(false)
          return
        }

        const res  = await apiGet(`/api/jobs/search/${userId}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || "Failed to fetch jobs")
        }
        const data = await res.json()
        setJobs(data.jobs)
        setLoading(false)

        // Poll while Internshala phase is still running
        const statusRes = await apiGet(`/api/jobs/status/${userId}`)
        const status    = await statusRes.json()
        if (status.detail?.includes("Internshala") && !pollTimer) {
          pollTimer = setInterval(async () => {
            const r = await apiGet(`/api/jobs/search/${userId}`)
            if (r.ok) { const d = await r.json(); setJobs(d.jobs) }
            const s  = await apiGet(`/api/jobs/status/${userId}`)
            const sd = await s.json()
            if (!sd.detail?.includes("Internshala") && pollTimer) {
              clearInterval(pollTimer); pollTimer = null
            }
          }, 5000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
        setLoading(false)
      }
    }

    fetchJobs()
    return () => { if (pollTimer) clearInterval(pollTimer) }
  }, [])

  const handleHide = useCallback((id: string) => {
    setHidden((prev) => new Set(prev).add(id))
  }, [])

  const visible = jobs.filter((j) => !hidden.has(j.id))


  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <p className="mb-2 font-mono text-sm text-primary">{"// ranked by TOPSIS engine"}</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          <FadeUpWords text="Your top matches" />
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sourced from Greenhouse, Lever, Ashby &amp; Internshala — filtered and ranked for you.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-32 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading your matches…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              {hidden.size > 0
                ? `You've hidden all ${hidden.size} jobs. Refresh to reset.`
                : "No matches yet — upload your resume in onboarding to get started."}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {visible.slice(0, shown).map((job) => (
                  <JobCardLarge key={job.id} job={job} onHide={handleHide} />
                ))}
              </div>

              {visible.length > shown && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setShown((s) => s + PAGE_SIZE)}
                    className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    Load more · {visible.length - shown} remaining
                  </button>
                </div>
              )}

              <p className="mt-4 text-center font-mono text-xs text-muted-foreground/40">
                Showing {Math.min(shown, visible.length)} of {visible.length} matches
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
