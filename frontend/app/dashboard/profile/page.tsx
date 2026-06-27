"use client"

import type React from "react"
import { useEffect, useState } from "react"
import {
  Briefcase, Check, GraduationCap, Loader2, Mail, MapPin,
  Pencil, Phone, Sparkles, Upload, FileText, Clock, X,
} from "lucide-react"
import { FadeUpWords } from "@/components/animated-text"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase"
import { apiGet, apiPost } from "@/lib/api"
import { cn } from "@/lib/utils"
import { PREDEFINED_ROLES, PREDEFINED_LOCATIONS } from "@/lib/onboarding-options"
import { UploadResumeDialog } from "@/components/dashboard/upload-resume-dialog"
import { useRouter } from "next/navigation"

/* ─── constants ────────────────────────────────────────────────────────────── */

const WORK_MODES        = ["Remote", "Hybrid", "Onsite", "Flexible"] as const
const EMPLOYMENT_TYPES  = ["Full-time", "Internship", "Contract", "Any"] as const
const EXP_LEVELS        = ["Fresher", "Junior (1-2 yrs)", "Mid (3-5 yrs)", "Senior (5+ yrs)"] as const
const AVAILABILITY_OPTS = ["Immediately", "2 weeks", "1 month", "3 months+"] as const
const WORK_AUTH_OPTS    = ["Indian Citizen / OCI", "Requires work visa", "Already on valid visa"] as const

/* ─── types ─────────────────────────────────────────────────────────────────── */

type OnboardingData = {
  name?: string
  phone?: string
  current_city?: string
  willing_to_relocate?: boolean
  preferred_roles?: string[]
  preferred_locations?: string[]
  work_mode?: string
  employment_type?: string
  experience_level?: string
  years_of_experience?: number
  salary_min_inr?: number
  salary_max_inr?: number
  availability?: string
  work_authorization?: string
  default_bio?: string
  open_to_screening?: boolean
  onboarding_complete?: boolean
  resumes?: { name: string; uploaded_at: string }[]
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

type FormState = {
  name: string
  phone: string
  current_city: string
  willing_to_relocate: boolean
  preferred_roles: string[]
  preferred_locations: string[]
  work_mode: string
  employment_type: string
  experience_level: string
  years_of_experience: string
  salary_min_inr: string
  salary_max_inr: string
  availability: string
  work_authorization: string
  default_bio: string
  open_to_screening: boolean
}

/* ─── small helpers ─────────────────────────────────────────────────────────── */

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-secondary text-secondary-foreground hover:border-primary/40",
      )}
    >
      {active && <Check className="mr-1.5 inline size-3" />}
      {label}
    </button>
  )
}

function PillSelect<T extends string>({
  options, value, onChange,
}: { options: readonly T[]; value: string; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            value === opt
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-secondary text-secondary-foreground hover:border-primary/40",
          )}
        >
          {value === opt && <Check className="mr-1.5 inline size-3" />}
          {opt}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label = "toggle" }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors",
        checked ? "bg-foreground border-transparent" : "bg-secondary border-border",
      )}
    >
      {/* Hidden native checkbox — browser handles aria-checked automatically */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="sr-only"
      />
      <span
        className={cn(
          "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </label>
  )
}

function Tag({ text }: { text: string }) {
  return (
    <span className="rounded-md border border-border bg-secondary px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {text}
    </span>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border pt-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

/* ─── page ───────────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const supabase = createClient()
  const router   = useRouter()

  const [userEmail,   setUserEmail]   = useState("")
  const [userId,      setUserId]      = useState("")
  const [onboarding,  setOnboarding]  = useState<OnboardingData>({})
  const [resumeData,  setResumeData]  = useState<ResumeData | null>(null)
  const [loading,     setLoading]     = useState(true)

  const [editing,     setEditing]     = useState(false)
  const [form,        setForm]        = useState<FormState>(emptyForm())
  const [saving,      setSaving]      = useState(false)
  const [reranking,   setReranking]   = useState(false)
  const [saveError,   setSaveError]   = useState("")

  function emptyForm(): FormState {
    return {
      name: "", phone: "", current_city: "", willing_to_relocate: false,
      preferred_roles: [], preferred_locations: [],
      work_mode: "", employment_type: "", experience_level: "",
      years_of_experience: "", salary_min_inr: "", salary_max_inr: "",
      availability: "", work_authorization: "", default_bio: "",
      open_to_screening: false,
    }
  }

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
            if (p.skills && !Array.isArray(p.skills))
              p.skills = Object.keys(p.skills)
            if (p.search_keywords && !Array.isArray(p.search_keywords))
              p.search_keywords = Object.keys(p.search_keywords)
            if (Array.isArray(p.projects))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              p.projects = p.projects.map((proj: any) => ({
                ...proj,
                tech: Array.isArray(proj.technologies) ? proj.technologies
                    : Array.isArray(proj.tech)         ? proj.tech
                    : Object.keys(proj.technologies ?? proj.tech ?? {}),
              }))
          }
          setResumeData(p)
        }
      } catch { /* no resume yet */ }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit() {
    const d = onboarding
    setForm({
      name:               d.name               ?? "",
      phone:              d.phone              ?? "",
      current_city:       d.current_city       ?? "",
      willing_to_relocate: d.willing_to_relocate ?? false,
      preferred_roles:    d.preferred_roles    ?? [],
      preferred_locations: d.preferred_locations ?? [],
      work_mode:          d.work_mode          ?? "",
      employment_type:    d.employment_type    ?? "",
      experience_level:   d.experience_level   ?? "",
      years_of_experience: d.years_of_experience != null ? String(d.years_of_experience) : "",
      salary_min_inr:     d.salary_min_inr     != null ? String(d.salary_min_inr) : "",
      salary_max_inr:     d.salary_max_inr     != null ? String(d.salary_max_inr) : "",
      availability:       d.availability       ?? "",
      work_authorization: d.work_authorization ?? "",
      default_bio:        d.default_bio        ?? "",
      open_to_screening:  d.open_to_screening  ?? false,
    })
    setSaveError("")
    setEditing(true)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleChip(val: string, key: "preferred_roles" | "preferred_locations") {
    setForm((prev) => {
      const list = prev[key]
      return { ...prev, [key]: list.includes(val) ? list.filter((v) => v !== val) : [...list, val] }
    })
  }

  async function saveEdit() {
    setSaving(true)
    setSaveError("")

    const updated: OnboardingData = {
      ...onboarding,
      name:               form.name.trim()         || undefined,
      phone:              form.phone.trim()        || undefined,
      current_city:       form.current_city.trim() || undefined,
      willing_to_relocate: form.willing_to_relocate,
      preferred_roles:    form.preferred_roles,
      preferred_locations: form.preferred_locations,
      work_mode:          form.work_mode          || undefined,
      employment_type:    form.employment_type    || undefined,
      experience_level:   form.experience_level   || undefined,
      years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : undefined,
      salary_min_inr:     form.salary_min_inr    ? Number(form.salary_min_inr)    : undefined,
      salary_max_inr:     form.salary_max_inr    ? Number(form.salary_max_inr)    : undefined,
      availability:       form.availability       || undefined,
      work_authorization: form.work_authorization || undefined,
      default_bio:        form.default_bio.trim() || undefined,
      open_to_screening:  form.open_to_screening,
    }

    const { error } = await supabase.from("profiles").upsert(
      { user_id: userId, profile_data: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

    if (error) { setSaveError(error.message); setSaving(false); return }

    setOnboarding(updated)
    setEditing(false)
    setSaving(false)

    const rolesChanged     = JSON.stringify(form.preferred_roles)     !== JSON.stringify(onboarding.preferred_roles     ?? [])
    const locationsChanged = JSON.stringify(form.preferred_locations) !== JSON.stringify(onboarding.preferred_locations ?? [])
    if (rolesChanged || locationsChanged) {
      setReranking(true)
      try {
        const fd = new FormData()
        fd.append("preferred_roles",      form.preferred_roles.join(","))
        fd.append("location_preferences", form.preferred_locations.join(","))
        await apiPost(`/api/profile/${userId}/update`, fd)
      } catch { /* non-fatal */ } finally {
        setReranking(false)
        router.push("/dashboard/jobs")
      }
    }
  }

  const displayName = onboarding.name || resumeData?.name || userEmail.split("@")[0] || "You"
  const initials    = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const weights = resumeData?.topsis_weights
    ? Object.entries(resumeData.topsis_weights).map(([k, v]) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1),
        value: v,
      }))
    : null

  const fmtSalary = (min?: number, max?: number) => {
    const f = (n: number) => `₹${(n / 100_000).toFixed(1)}L`
    if (min && max) return `${f(min)} – ${f(max)}`
    if (min) return `${f(min)}+`
    if (max) return `up to ${f(max)}`
    return null
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="animate-pulse text-sm text-muted-foreground">Loading profile…</p>
      </main>
    )
  }

  /* ──────────────────────────── EDIT MODE ────────────────────────────────── */

  if (editing) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Edit profile</h1>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" /> Cancel
          </button>
        </div>

        <div className="space-y-0 rounded-2xl border border-border bg-card p-8">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full name</Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} className="mt-1.5" placeholder="Ansh Madaan" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} className="mt-1.5" placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current city</Label>
              <Input value={form.current_city} onChange={(e) => setField("current_city", e.target.value)} className="mt-1.5" placeholder="Bangalore" />
            </div>
            <div className="flex items-end gap-3 pb-0.5">
              <div className="flex items-center gap-2.5">
                <Toggle label="Open to relocation" checked={form.willing_to_relocate} onChange={(v) => setField("willing_to_relocate", v)} />
                <Label className="cursor-pointer text-sm" onClick={() => setField("willing_to_relocate", !form.willing_to_relocate)}>
                  Open to relocation
                </Label>
              </div>
            </div>
          </div>

          {/* Preferred roles */}
          <FormSection title="Preferred roles">
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ROLES.map((r) => (
                <Chip key={r} label={r} active={form.preferred_roles.includes(r)} onClick={() => toggleChip(r, "preferred_roles")} />
              ))}
            </div>
          </FormSection>

          {/* Preferred locations */}
          <FormSection title="Preferred locations">
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_LOCATIONS.map((l) => (
                <Chip key={l} label={l} active={form.preferred_locations.includes(l)} onClick={() => toggleChip(l, "preferred_locations")} />
              ))}
            </div>
          </FormSection>

          {/* Work style */}
          <FormSection title="Work mode">
            <PillSelect options={WORK_MODES} value={form.work_mode} onChange={(v) => setField("work_mode", v)} />
          </FormSection>

          <FormSection title="Employment type">
            <PillSelect options={EMPLOYMENT_TYPES} value={form.employment_type} onChange={(v) => setField("employment_type", v)} />
          </FormSection>

          {/* Experience */}
          <FormSection title="Experience">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Level</p>
              <PillSelect options={EXP_LEVELS} value={form.experience_level} onChange={(v) => setField("experience_level", v)} />
            </div>
            <div className="mt-4">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Years of experience</Label>
              <Input
                type="number" min={0} max={50}
                value={form.years_of_experience}
                onChange={(e) => setField("years_of_experience", e.target.value)}
                className="mt-1.5 w-40"
                placeholder="0"
              />
            </div>
          </FormSection>

          {/* Compensation */}
          <FormSection title="Compensation (INR)">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Minimum salary</Label>
                <Input
                  type="number" min={0}
                  value={form.salary_min_inr}
                  onChange={(e) => setField("salary_min_inr", e.target.value)}
                  className="mt-1.5"
                  placeholder="800000"
                />
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
                  {form.salary_min_inr ? `₹${(Number(form.salary_min_inr) / 100_000).toFixed(1)}L` : "e.g. 8,00,000"}
                </p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Maximum salary</Label>
                <Input
                  type="number" min={0}
                  value={form.salary_max_inr}
                  onChange={(e) => setField("salary_max_inr", e.target.value)}
                  className="mt-1.5"
                  placeholder="2000000"
                />
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
                  {form.salary_max_inr ? `₹${(Number(form.salary_max_inr) / 100_000).toFixed(1)}L` : "e.g. 20,00,000"}
                </p>
              </div>
            </div>
          </FormSection>

          {/* Availability */}
          <FormSection title="Availability">
            <PillSelect options={AVAILABILITY_OPTS} value={form.availability} onChange={(v) => setField("availability", v)} />
          </FormSection>

          {/* Additional */}
          <FormSection title="Additional">
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Work authorization</p>
              <PillSelect options={WORK_AUTH_OPTS} value={form.work_authorization} onChange={(v) => setField("work_authorization", v)} />
            </div>

            <div className="mt-4">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Bio / headline</Label>
              <Textarea
                value={form.default_bio}
                onChange={(e) => setField("default_bio", e.target.value)}
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="A short headline shown in auto-apply and profile exports."
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Toggle label="Open to recruiter screening" checked={form.open_to_screening} onChange={(v) => setField("open_to_screening", v)} />
              <div>
                <p className="text-sm">Open to recruiter screening calls</p>
                <p className="font-mono text-[11px] text-muted-foreground/60">Used by the upcoming auto-apply feature</p>
              </div>
            </div>
          </FormSection>

          {/* Actions */}
          <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
            {reranking ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Re-ranking your matches…
              </span>
            ) : (
              <>
                <Button onClick={saveEdit} disabled={saving || reranking}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
              </>
            )}
            {saveError && <p className="ml-2 text-sm text-destructive">{saveError}</p>}
          </div>
        </div>
      </main>
    )
  }

  /* ──────────────────────────── VIEW MODE ────────────────────────────────── */

  const salary = fmtSalary(onboarding.salary_min_inr, onboarding.salary_max_inr)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-2 font-mono text-sm text-primary">{"// your career profile"}</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            <FadeUpWords text="Your profile" />
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={startEdit} className="mt-1">
          <Pencil className="mr-1.5 size-3.5" />
          Edit profile
        </Button>
      </div>

      {/* ── Header card ── */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-16 border border-border">
            <AvatarFallback className="bg-secondary text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">{displayName}</h2>
            {(resumeData?.preferred_roles?.[0] || onboarding.experience_level) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {resumeData?.preferred_roles?.[0] ?? onboarding.experience_level}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {userEmail && (
                <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{userEmail}</span>
              )}
              {onboarding.phone && (
                <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{onboarding.phone}</span>
              )}
              {onboarding.current_city && (
                <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{onboarding.current_city}</span>
              )}
              {onboarding.availability && (
                <span className="flex items-center gap-1.5"><Clock className="size-3.5" />Available {onboarding.availability.toLowerCase()}</span>
              )}
            </div>

            {/* Tags row */}
            <div className="mt-3 flex flex-wrap gap-2">
              {onboarding.work_mode      && <Tag text={onboarding.work_mode} />}
              {onboarding.employment_type && <Tag text={onboarding.employment_type} />}
              {onboarding.experience_level && <Tag text={onboarding.experience_level} />}
              {onboarding.willing_to_relocate && <Tag text="Open to relocation" />}
              {onboarding.open_to_screening && <Tag text="Open to screening" />}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            {resumeData?.total_experience_years != null && (
              <>
                <div className="text-2xl font-semibold tabular-nums">{resumeData.total_experience_years}y</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Experience</div>
              </>
            )}
            {salary && (
              <div className="mt-2 font-mono text-sm text-muted-foreground">{salary}</div>
            )}
          </div>
        </div>

        {/* Bio */}
        {onboarding.default_bio && (
          <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
            {onboarding.default_bio}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column (2/3) ── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Preferences */}
          {((onboarding.preferred_roles?.length ?? 0) > 0 || (onboarding.preferred_locations?.length ?? 0) > 0) && (
            <Section title="Job preferences" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="space-y-4">
                {(onboarding.preferred_roles?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {onboarding.preferred_roles!.map((r) => (
                        <span key={r} className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(onboarding.preferred_locations?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Locations</p>
                    <div className="flex flex-wrap gap-2">
                      {onboarding.preferred_locations!.map((l) => (
                        <span key={l} className="rounded-lg border border-border bg-secondary px-3 py-1 text-sm">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

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
                <p className="text-sm text-muted-foreground">No resumes uploaded yet.</p>
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

          {/* Skills */}
          {resumeData?.skills && resumeData.skills.length > 0 && (
            <Section title="Skills" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="flex flex-wrap gap-2">
                {resumeData.skills.map((s) => (
                  <span key={s} className="rounded-lg border border-border bg-secondary px-3 py-1 text-sm">{s}</span>
                ))}
              </div>
            </Section>
          )}

          {/* Projects */}
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

        {/* ── Right sidebar (1/3) ── */}
        <div className="space-y-6">

          {/* Work details summary */}
          {(onboarding.work_authorization || onboarding.salary_min_inr || onboarding.salary_max_inr) && (
            <Section title="Details" icon={<Sparkles className="size-4 text-primary" />}>
              <div className="space-y-2 text-sm">
                {salary && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected salary</span>
                    <span className="font-mono">{salary}</span>
                  </div>
                )}
                {onboarding.work_authorization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Work auth</span>
                    <span className="text-right text-xs">{onboarding.work_authorization}</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Education */}
          {resumeData?.education && (
            <Section title="Education" icon={<GraduationCap className="size-4 text-primary" />}>
              <p className="text-sm">{resumeData.education}</p>
            </Section>
          )}

          {/* Ranking weights */}
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
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(w.value * 100 * 3.33, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Keywords */}
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
