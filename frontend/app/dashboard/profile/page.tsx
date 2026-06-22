"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  Briefcase, Check, GraduationCap, Mail, MapPin,
  Pencil, Phone, Sparkles, Upload, FileText,
} from "lucide-react"
import { FadeUpWords } from "@/components/animated-text"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { apiGet } from "@/lib/api"
import { cn } from "@/lib/utils"
import { PREDEFINED_ROLES, PREDEFINED_LOCATIONS } from "@/lib/onboarding-options"
import { UploadResumeDialog } from "@/components/dashboard/upload-resume-dialog"

type OnboardingData = {
  name?: string
  phone?: string
  preferred_roles?: string[]
  preferred_locations?: string[]
  resumes?: { name: string; uploaded_at: string }[]
  onboarding_complete?: boolean
}

type ResumeData = {
  name?: string
  preferred_roles?: string[]
  skills?: string[]
  education?: string
  total_experience_years?: number
  search_keywords?: string[]
  projects?: { name: string; description: string; tech: string[] }[]
  topsis_weights?: Record<string, number>
}

export default function ProfilePage() {
  const supabase = createClient()

  const [userEmail, setUserEmail] = useState("")
  const [userId, setUserId] = useState("")
  const [onboarding, setOnboarding] = useState<OnboardingData>({})
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editLocations, setEditLocations] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)
      setUserEmail(user.email || "")

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("profile_data")
        .eq("user_id", user.id)
        .single()

      setOnboarding(profileRow?.profile_data || {})

      try {
        const res = await apiGet(`/api/profile/${user.id}`)
        if (res.ok) {
          const data = await res.json()
          const p = data.profile || null
          if (p) {
            // Gemini may return skills/keywords as {skill: true} objects — normalise to arrays
            if (p.skills && !Array.isArray(p.skills))
              p.skills = Object.keys(p.skills)
            if (p.search_keywords && !Array.isArray(p.search_keywords))
              p.search_keywords = Object.keys(p.search_keywords)
            // Normalise tech arrays inside projects too
            if (Array.isArray(p.projects))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              p.projects = p.projects.map((proj: any) => ({
                ...proj,
                // backend uses "technologies", frontend renders "tech"
                tech: Array.isArray(proj.technologies) ? proj.technologies
                    : Array.isArray(proj.tech)         ? proj.tech
                    : Object.keys(proj.technologies ?? proj.tech ?? {}),
              }))
          }
          setResumeData(p)
        }
      } catch {
        // No resume uploaded yet
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit() {
    setEditName(onboarding.name || "")
    setEditPhone(onboarding.phone || "")
    setEditRoles(onboarding.preferred_roles || [])
    setEditLocations(onboarding.preferred_locations || [])
    setSaveError("")
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    setSaveError("")

    const updated: OnboardingData = {
      ...onboarding,
      name: editName.trim(),
      phone: editPhone.trim(),
      preferred_roles: editRoles,
      preferred_locations: editLocations,
    }

    const { error } = await supabase.from("profiles").upsert(
      { user_id: userId, profile_data: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

    if (error) { setSaveError(error.message); setSaving(false); return }

    setOnboarding(updated)
    setEditing(false)
    setSaving(false)
  }

  function toggleChip(val: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(val) ? list.filter((v) => v !== val) : [...list, val])
  }

  const displayName = onboarding.name || resumeData?.name || userEmail.split("@")[0] || "You"
  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const weights = resumeData?.topsis_weights
    ? Object.entries(resumeData.topsis_weights).map(([k, v]) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1),
        value: v,
      }))
    : null

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="animate-pulse text-sm text-muted-foreground">Loading profile...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-2 font-mono text-sm text-primary">{"// your career profile"}</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            <FadeUpWords text="Your profile" />
          </h1>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit} className="mt-1">
            <Pencil className="mr-1.5 size-3.5" />
            Edit profile
          </Button>
        )}
      </div>

      {/* ── Header card ── */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-16 border border-border">
            <AvatarFallback className="bg-secondary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
                  <Input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1.5" placeholder="+91 98765 43210" />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold tracking-tight">{displayName}</h2>
                {resumeData?.preferred_roles?.[0] && <p className="text-primary">{resumeData.preferred_roles[0]}</p>}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {userEmail && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{userEmail}</span>}
                  {onboarding.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{onboarding.phone}</span>}
                  {(onboarding.preferred_locations?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {onboarding.preferred_locations!.slice(0, 2).join(", ")}
                      {onboarding.preferred_locations!.length > 2 && ` +${onboarding.preferred_locations!.length - 2}`}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {resumeData?.total_experience_years && !editing && (
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">{resumeData.total_experience_years}y</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Experience</div>
            </div>
          )}
        </div>

        {/* Edit expanded section: roles + locations chips */}
        {editing && (
          <div className="mt-5 space-y-5 border-t border-border pt-5">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Preferred roles</p>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_ROLES.map((r) => {
                  const active = editRoles.includes(r)
                  return (
                    <button key={r} onClick={() => toggleChip(r, editRoles, setEditRoles)}
                      className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
                      )}>
                      {active && <Check className="mr-1.5 inline size-3" />}{r}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Preferred locations</p>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_LOCATIONS.map((l) => {
                  const active = editLocations.includes(l)
                  return (
                    <button key={l} onClick={() => toggleChip(l, editLocations, setEditLocations)}
                      className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
                      )}>
                      {active && <Check className="mr-1.5 inline size-3" />}{l}
                    </button>
                  )
                })}
              </div>
            </div>

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Resumes */}
          <Section title="Resumes" icon={<FileText className="size-4 text-primary" />}>
            <div className="space-y-2">
              {onboarding.resumes && onboarding.resumes.length > 0 ? (
                [...onboarding.resumes].reverse().map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    {i === 0 && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">Active</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No resumes uploaded yet. Upload one to start matching jobs.</p>
              )}
              <div className="pt-1">
                <UploadResumeDialog>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-1.5 size-3.5" />
                    Upload new resume
                  </Button>
                </UploadResumeDialog>
              </div>
            </div>
          </Section>

          {resumeData?.skills && resumeData.skills.length > 0 && (
            <Section title="Skills" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-2">
                {resumeData.skills.map((s) => (
                  <span key={s} className="rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-secondary-foreground">{s}</span>
                ))}
              </div>
            </Section>
          )}

          {resumeData?.projects && resumeData.projects.length > 0 && (
            <Section title="Projects" icon={<Briefcase className="size-4 text-primary" />}>
              <div className="space-y-4">
                {resumeData.projects.map((p) => (
                  <div key={p.name} className="rounded-xl border border-border bg-secondary/40 p-4">
                    <h4 className="font-medium">{p.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.tech?.map((t) => (
                        <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-6">
          {!editing && (onboarding.preferred_roles?.length ?? 0) > 0 && (
            <Section title="Preferred roles" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-2">
                {onboarding.preferred_roles!.map((r) => (
                  <span key={r} className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1 text-sm text-primary">{r}</span>
                ))}
              </div>
            </Section>
          )}

          {!editing && (onboarding.preferred_locations?.length ?? 0) > 0 && (
            <Section title="Preferred locations" icon={<MapPin className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-2">
                {onboarding.preferred_locations!.map((l) => (
                  <span key={l} className="rounded-lg border border-border bg-secondary px-3 py-1 text-sm">{l}</span>
                ))}
              </div>
            </Section>
          )}

          {resumeData?.education && (
            <Section title="Education" icon={<GraduationCap className="size-4 text-primary" />}>
              <p className="text-sm">{resumeData.education}</p>
            </Section>
          )}

          {weights && (
            <Section title="Ranking weights" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="space-y-3">
                {weights.map((w) => (
                  <div key={w.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">{w.label}</span>
                      <span className="font-mono">{w.value.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      {/* dynamic width — inline style unavoidable for runtime value */}
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(w.value * 100 * 3.33, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {resumeData?.search_keywords && resumeData.search_keywords.length > 0 && (
            <Section title="Search keywords" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-1.5">
                {resumeData.search_keywords.map((k) => (
                  <span key={k} className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{k}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </main>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {icon}{title}
      </h3>
      {children}
    </section>
  )
}
