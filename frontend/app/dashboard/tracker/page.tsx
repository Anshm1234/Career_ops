"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLink, Plus, Trash2, Loader2 } from "lucide-react"
import { FadeUpWords } from "@/components/animated-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"

/* ─── types ──────────────────────────────────────────────────────────────────── */

type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected"

type Application = {
  id: string
  job_id: string
  company: string
  role: string
  url: string
  source: string | null
  topsis_score: number | null
  topsis_rank:  number | null
  status: AppStatus
  applied_at: string
  notes: string | null
  updated_at: string
}

type AddForm = {
  company: string
  role: string
  url: string
  source: string
  status: AppStatus
  applied_at: string
  notes: string
}

/* ─── constants ──────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<AppStatus, { label: string; cls: string }> = {
  saved:     { label: "Saved",     cls: "border-border text-muted-foreground" },
  applied:   { label: "Applied",   cls: "border-primary/40 bg-primary/5 text-primary" },
  interview: { label: "Interview", cls: "border-foreground/30 bg-foreground/5 text-foreground" },
  offer:     { label: "Offer",     cls: "border-foreground/60 bg-foreground/10 text-foreground" },
  rejected:  { label: "Rejected",  cls: "border-destructive/40 bg-destructive/5 text-destructive" },
}

const STATUSES = Object.keys(STATUS_CONFIG) as AppStatus[]

const SUMMARY_STATS: { status: AppStatus; label: string }[] = [
  { status: "applied",   label: "Applied"    },
  { status: "interview", label: "Interviews" },
  { status: "offer",     label: "Offers"     },
  { status: "rejected",  label: "Rejected"   },
  { status: "saved",     label: "Saved"      },
]

function emptyForm(): AddForm {
  return {
    company:    "",
    role:       "",
    url:        "",
    source:     "",
    status:     "applied",
    applied_at: new Date().toISOString().slice(0, 10),
    notes:      "",
  }
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function TrackerPage() {
  const supabase = createClient()

  const [userId,  setUserId]  = useState<string | null>(null)
  const [apps,    setApps]    = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // filter
  const [filter, setFilter] = useState<AppStatus | "all">("all")

  // add dialog
  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState<AddForm>(emptyForm())
  const [adding,   setAdding]   = useState(false)
  const [addError, setAddError] = useState("")

  // edit notes inline
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue,   setNotesValue]   = useState("")
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the notes textarea when edit mode activates
  useEffect(() => {
    if (editingNotes !== null) {
      notesRef.current?.focus()
    }
  }, [editingNotes])

  /* ── load ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data, error: fetchErr } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", user.id)
        .order("applied_at", { ascending: false })

      if (fetchErr) setError(fetchErr.message)
      else          setApps((data ?? []) as Application[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── update status ── */
  async function updateStatus(id: string, status: AppStatus) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    await supabase
      .from("applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
  }

  /* ── delete ── */
  async function deleteApp(id: string) {
    setApps((prev) => prev.filter((a) => a.id !== id))
    await supabase
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
  }

  /* ── save notes ── */
  async function saveNotes(id: string) {
    const notes = notesValue.trim() || null
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, notes } : a)))
    setEditingNotes(null)
    await supabase
      .from("applications")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
  }

  /* ── add manually ── */
  async function handleAdd() {
    if (!addForm.company.trim() || !addForm.role.trim()) {
      setAddError("Company and role are required.")
      return
    }
    if (!userId) return
    setAdding(true)
    setAddError("")

    const { data, error: insertErr } = await supabase
      .from("applications")
      .insert({
        user_id:      userId,
        job_id:       `manual-${Date.now()}`,
        company:      addForm.company.trim(),
        role:         addForm.role.trim(),
        url:          addForm.url.trim() || "#",
        source:       addForm.source.trim() || "manual",
        status:       addForm.status,
        applied_at:   new Date(addForm.applied_at).toISOString(),
        notes:        addForm.notes.trim() || null,
      })
      .select()
      .single()

    if (insertErr) {
      setAddError(insertErr.message)
    } else {
      setApps((prev) => [data as Application, ...prev])
      setShowAdd(false)
      setAddForm(emptyForm())
    }
    setAdding(false)
  }

  /* ── derived ── */
  const visible = filter === "all" ? apps : apps.filter((a) => a.status === filter)

  function fmtDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
    } catch { return iso }
  }

  /* ─────────────────────────── RENDER ──────────────────────────────────────── */

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-2 font-mono text-sm text-primary">{"// application pipeline"}</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            <FadeUpWords text="Application tracker" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track every application from submission to offer.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setShowAdd(true); setAddForm(emptyForm()); setAddError("") }}
          className="mt-1 h-8 gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          Add manually
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SUMMARY_STATS.map(({ status, label }) => {
          const count = apps.filter((a) => a.status === status).length
          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(filter === status ? "all" : status)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/30",
                filter === status ? "border-primary/40 bg-primary/5" : "border-border",
              )}
            >
              <span className="block text-2xl font-semibold tabular-nums">{count}</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
              filter === s
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground hover:border-primary/20",
            )}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s].label}
            {s !== "all" && (
              <span className="ml-1.5 opacity-50">
                {apps.filter((a) => a.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="flex items-center gap-3 py-20 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading applications…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && apps.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center">
          <p className="text-sm font-medium">No applications tracked yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one manually, or apply to a job from the matches page.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAdd(true)}
            className="mt-4"
          >
            <Plus className="mr-1.5 size-3.5" />
            Add your first application
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && apps.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-mono text-xs text-muted-foreground">
              {visible.length === apps.length
                ? `${apps.length} application${apps.length !== 1 ? "s" : ""}`
                : `${visible.length} of ${apps.length} shown`}
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No {STATUS_CONFIG[filter as AppStatus]?.label.toLowerCase()} entries.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Company", "Role", "Source", "Score", "Date", "Status", "Notes", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((app, i) => (
                    <tr
                      key={app.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-secondary/20",
                        i === visible.length - 1 && "border-b-0",
                      )}
                    >
                      {/* Company */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                            {app.company.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-medium">{app.company}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="max-w-[200px] px-4 py-4">
                        <span className="line-clamp-1 text-sm">{app.role}</span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {app.source ?? "—"}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-4">
                        {app.topsis_score != null ? (
                          <span className="font-mono text-sm text-primary">
                            {Math.round(app.topsis_score * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {fmtDate(app.applied_at)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <select
                          aria-label="Application status"
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value as AppStatus)}
                          className={cn(
                            "cursor-pointer rounded-full border bg-transparent px-3 py-1 font-mono text-[11px] outline-none transition-colors",
                            STATUS_CONFIG[app.status]?.cls,
                          )}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-background text-foreground">
                              {STATUS_CONFIG[s].label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-4">
                        {editingNotes === app.id ? (
                          <div className="flex items-center gap-1.5">
                            <textarea
                              ref={notesRef}
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNotes(app.id) }
                                if (e.key === "Escape") setEditingNotes(null)
                              }}
                              rows={1}
                              aria-label="Application notes"
                              placeholder="Add a note…"
                              className="w-36 resize-none rounded border border-border bg-secondary px-2 py-1 font-mono text-[11px] outline-none focus:border-primary/40"
                            />
                            <button
                              type="button"
                              onClick={() => saveNotes(app.id)}
                              className="shrink-0 rounded px-1.5 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingNotes(app.id); setNotesValue(app.notes ?? "") }}
                            className="max-w-[140px] truncate font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground"
                          >
                            {app.notes ?? <span className="italic opacity-40">add note</span>}
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {app.url && app.url !== "#" && (
                            <a
                              href={app.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                              aria-label="Open posting"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteApp(app.id)}
                            aria-label="Delete application"
                            className="text-muted-foreground/30 transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add manually dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add application</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Company <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={addForm.company}
                  onChange={(e) => setAddForm((f) => ({ ...f, company: e.target.value }))}
                  className="mt-1.5"
                  placeholder="Anthropic"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Source</Label>
                <Input
                  value={addForm.source}
                  onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                  className="mt-1.5"
                  placeholder="LinkedIn, referral…"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Role <span className="text-destructive">*</span>
              </Label>
              <Input
                value={addForm.role}
                onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                className="mt-1.5"
                placeholder="Software Engineer"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Job URL</Label>
              <Input
                type="url"
                value={addForm.url}
                onChange={(e) => setAddForm((f) => ({ ...f, url: e.target.value }))}
                className="mt-1.5"
                placeholder="https://…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Status</Label>
                <select
                  aria-label="Application status"
                  value={addForm.status}
                  onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as AppStatus }))}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Applied on</Label>
                <Input
                  type="date"
                  value={addForm.applied_at}
                  onChange={(e) => setAddForm((f) => ({ ...f, applied_at: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Notes</Label>
              <Textarea
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1.5 resize-none"
                rows={2}
                placeholder="Recruiter name, next steps…"
              />
            </div>

            {addError && <p className="text-sm text-destructive">{addError}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} disabled={adding} className="flex-1">
                {adding ? <><Loader2 className="mr-2 size-3.5 animate-spin" />Adding…</> : "Add application"}
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)} disabled={adding}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
