"use client"

import { useState } from "react"
import { ExternalLink, Plus } from "lucide-react"
import { FadeUpWords } from "@/components/animated-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppStatus = "applied" | "interview" | "offer" | "rejected" | "saved"

interface Application {
  id: string
  company: string
  companyInitials: string
  role: string
  source: string
  score: number
  appliedDate: string
  status: AppStatus
  url: string
}

const INITIAL: Application[] = [
  { id: "1", company: "Anthropic",  companyInitials: "AN", role: "ML Engineer, Safeguards",            source: "greenhouse", score: 0.91, appliedDate: "May 27", status: "applied",   url: "#" },
  { id: "2", company: "Scale AI",   companyInitials: "SC", role: "ML Research Engineer, Agents",       source: "greenhouse", score: 0.84, appliedDate: "May 26", status: "interview", url: "#" },
  { id: "3", company: "Databricks", companyInitials: "DB", role: "Senior Backend Engineer, AI/ML",     source: "greenhouse", score: 0.72, appliedDate: "May 25", status: "rejected",  url: "#" },
  { id: "4", company: "Twilio",     companyInitials: "TW", role: "Staff Machine Learning Engineer",    source: "greenhouse", score: 0.68, appliedDate: "May 24", status: "applied",   url: "#" },
  { id: "5", company: "Cursor",     companyInitials: "CU", role: "AI Engineer",                        source: "ashby",      score: 0.61, appliedDate: "May 23", status: "offer",     url: "#" },
  { id: "6", company: "Groq",       companyInitials: "GQ", role: "ML Infrastructure Engineer",         source: "ashby",      score: 0.58, appliedDate: "May 22", status: "saved",     url: "#" },
  { id: "7", company: "Mistral",    companyInitials: "MI", role: "Research Engineer",                  source: "ashby",      score: 0.55, appliedDate: "May 21", status: "applied",   url: "#" },
]

const STATUS_CONFIG: Record<AppStatus, { label: string; className: string }> = {
  saved:     { label: "Saved",     className: "border-border text-muted-foreground" },
  applied:   { label: "Applied",   className: "border-primary/40 bg-primary/5 text-primary" },
  interview: { label: "Interview", className: "border-blue-500/40 bg-blue-500/5 text-blue-400" },
  offer:     { label: "Offer",     className: "border-green-500/40 bg-green-500/5 text-green-400" },
  rejected:  { label: "Rejected",  className: "border-destructive/40 bg-destructive/5 text-destructive" },
}

const SUMMARY_STATS = [
  { status: "applied"   as AppStatus, label: "Applied" },
  { status: "interview" as AppStatus, label: "Interviews" },
  { status: "offer"     as AppStatus, label: "Offers" },
  { status: "rejected"  as AppStatus, label: "Rejected" },
  { status: "saved"     as AppStatus, label: "Saved" },
]

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>(INITIAL)

  function updateStatus(id: string, status: AppStatus) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-2 font-mono text-sm text-primary">{"// application pipeline"}</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          <FadeUpWords text="Application tracker" />
        </h1>
        <p className="mt-2 text-muted-foreground">
          Track every application from submission to offer.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SUMMARY_STATS.map(({ status, label }) => {
          const count = apps.filter((a) => a.status === status).length
          return (
            <div key={status} className="rounded-xl border border-border bg-card p-4">
              <div className="text-2xl font-semibold tabular-nums">{count}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-mono text-xs text-muted-foreground">
            {apps.length} applications tracked
          </p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-transparent">
            <Plus className="size-3.5" />
            Add manually
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Applied</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app, i) => (
                <tr
                  key={app.id}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-secondary/20",
                    i === apps.length - 1 && "border-b-0"
                  )}
                >
                  {/* Company */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-semibold text-muted-foreground">
                        {app.companyInitials}
                      </span>
                      <span className="font-medium">{app.company}</span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-foreground">{app.role}</span>
                  </td>

                  {/* Source */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-muted-foreground">{app.source}</span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm text-primary">
                      {Math.round(app.score * 100)}%
                    </span>
                  </td>

                  {/* Applied date */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-muted-foreground">{app.appliedDate}</span>
                  </td>

                  {/* Status dropdown */}
                  <td className="px-4 py-4">
                    <select
                        aria-label="Application status"
                        value={app.status}
                        onChange={(e) => updateStatus(app.id, e.target.value as AppStatus)}
                        className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium bg-transparent outline-none cursor-pointer transition-colors",
                            STATUS_CONFIG[app.status as AppStatus]?.className
                        )}
                    >
                      {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
                        <option key={val} value={val} className="bg-background text-foreground">
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Link */}
                  <td className="px-4 py-4">
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
