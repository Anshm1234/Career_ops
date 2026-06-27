"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, UploadCloud, FileUp, Loader2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { apiPost, apiGet } from "@/lib/api"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PREDEFINED_ROLES, PREDEFINED_LOCATIONS } from "@/lib/onboarding-options"

/* ─── constants ────────────────────────────────────────────────────────────── */

const TOTAL_STEPS = 6

const WORK_MODES        = ["Remote", "Hybrid", "Onsite", "Flexible"] as const
const EMPLOYMENT_TYPES  = ["Full-time", "Internship", "Contract", "Any"] as const
const EXP_LEVELS        = ["Fresher", "Junior (1-2 yrs)", "Mid (3-5 yrs)", "Senior (5+ yrs)"] as const
const AVAILABILITY_OPTS = ["Immediately", "2 weeks", "1 month", "3 months+"] as const
const WORK_AUTH_OPTS    = ["Indian Citizen / OCI", "Requires work visa", "Already on valid visa"] as const

const UPLOAD_STAGES = [
  "Parsing resume with AI",
  "Filtering & ranking matches",
  "Done — matches ready",
]

const DEFAULT_WEIGHTS = {
  weight_skill:     0.30,
  weight_salary:    0.30,
  weight_role:      0.20,
  weight_location:  0.10,
  weight_seniority: 0.10,
}

/* ─── small reusable chip ──────────────────────────────────────────────────── */

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
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

/* ─── pill single-select ───────────────────────────────────────────────────── */

function PillSelect<T extends string>({
  options, value, onChange,
}: { options: readonly T[]; value: T | ""; onChange: (v: T) => void }) {
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

/* ─── main page ────────────────────────────────────────────────────────────── */

export default function OnboardingPage() {
  const router  = useRouter()
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  /* auth */
  const [userId,    setUserId]    = useState("")
  const [userEmail, setUserEmail] = useState("")

  /* step */
  const [step,  setStep]  = useState(1)
  const [error, setError] = useState("")

  /* step 1 — basics */
  const [name,             setName]             = useState("")
  const [phone,            setPhone]            = useState("")
  const [currentCity,      setCurrentCity]      = useState("")
  const [willingToRelocate, setWillingToRelocate] = useState<"yes" | "no" | "">("")

  /* step 2 — roles */
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  /* step 3 — locations + work mode + employment type */
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [workMode,          setWorkMode]          = useState<typeof WORK_MODES[number] | "">("")
  const [employmentType,    setEmploymentType]    = useState<typeof EMPLOYMENT_TYPES[number] | "">("")

  /* step 4 — experience + salary */
  const [expLevel,      setExpLevel]      = useState<typeof EXP_LEVELS[number] | "">("")
  const [yearsOfExp,    setYearsOfExp]    = useState("")
  const [salaryMin,     setSalaryMin]     = useState("")
  const [salaryMax,     setSalaryMax]     = useState("")
  const [availability,  setAvailability]  = useState<typeof AVAILABILITY_OPTS[number] | "">("")

  /* step 5 — auto-apply prep */
  const [workAuth,        setWorkAuth]        = useState<typeof WORK_AUTH_OPTS[number] | "">("")
  const [defaultBio,      setDefaultBio]      = useState("")
  const [openToScreening, setOpenToScreening] = useState<"yes" | "no" | "">("")

  /* step 6 — resume upload */
  const [file,        setFile]        = useState<File | null>(null)
  const [dragging,    setDragging]    = useState(false)
  const [uploadStage, setUploadStage] = useState(-1)  // -1 idle, 0-2 pipeline
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)

  /* ── load user on mount ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/"); return }
      setUserId(user.id)
      setUserEmail(user.email || "")
      const meta = user.user_metadata
      setName(meta?.full_name || meta?.name || "")
      // Skip if already onboarded
      supabase.from("profiles").select("profile_data").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.profile_data?.onboarding_complete) router.replace("/dashboard/jobs")
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── validation per step ── */
  function validate(): string {
    if (step === 1) {
      if (!name.trim()) return "Please enter your name"
    }
    if (step === 2) {
      if (selectedRoles.length === 0) return "Select at least one role"
    }
    if (step === 3) {
      if (selectedLocations.length === 0) return "Select at least one location"
    }
    if (step === 4) {
      // all optional — no hard validation
    }
    if (step === 5) {
      // all optional
    }
    return ""
  }

  /* ── save steps 1-5 to Supabase before upload ── */
  async function savePreferences() {
    const { error: dbErr } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        profile_data: {
          name:              name.trim(),
          phone:             phone.trim(),
          email:             userEmail,
          current_city:      currentCity.trim(),
          willing_to_relocate: willingToRelocate === "yes",
          preferred_roles:   selectedRoles,
          preferred_locations: selectedLocations,
          work_mode:         workMode,
          employment_type:   employmentType,
          experience_level:  expLevel,
          years_of_experience: yearsOfExp ? Number(yearsOfExp) : null,
          salary_min_inr:    salaryMin ? Number(salaryMin.replace(/,/g, "")) : null,
          salary_max_inr:    salaryMax ? Number(salaryMax.replace(/,/g, "")) : null,
          availability:      availability,
          work_authorization: workAuth,
          default_bio:       defaultBio.trim(),
          open_to_screening: openToScreening === "yes",
          onboarding_complete: false,  // set true only after upload
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    return dbErr
  }

  /* ── navigation ── */
  async function advance() {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError("")
    // Save preferences when transitioning to upload step
    if (step === 5) {
      setSaving(true)
      const err = await savePreferences()
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    setStep((s) => s + 1)
  }

  function back() {
    setError("")
    setUploadError(null)
    setStep((s) => s - 1)
  }

  /* ── upload + poll pipeline ── */
  function handleFileDrop(f?: File | null) {
    if (f) { setFile(f); setUploadError(null) }
  }

  async function pollStatus(uid: string) {
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res  = await apiGet(`/api/jobs/status/${uid}`)
          const data = await res.json()
          if (data.status === "filtering") setUploadStage(1)
          if (data.status === "ready") {
            clearInterval(interval)
            setUploadStage(2)
            resolve()
          }
          if (data.status === "failed") {
            clearInterval(interval)
            reject(new Error(`Pipeline failed: ${data.detail}`))
          }
        } catch (e) {
          clearInterval(interval)
          reject(e)
        }
      }, 2000)
    })
  }

  async function runUpload() {
    if (!file) { setUploadError("Please select a resume file"); return }
    setUploadError(null)
    setUploadStage(0)

    try {
      const form = new FormData()
      form.append("file", file)
      if (selectedRoles.length)     form.append("preferred_roles",     selectedRoles.join(", "))
      if (selectedLocations.length) form.append("location_preferences", selectedLocations.join(", "))
      if (salaryMin) form.append("salary_min", salaryMin.replace(/,/g, ""))
      if (salaryMax) form.append("salary_max", salaryMax.replace(/,/g, ""))
      // Send default TOPSIS weights
      Object.entries(DEFAULT_WEIGHTS).forEach(([k, v]) => form.append(k, String(v)))

      // Direct to backend (FormData → apiPost bypasses Vercel proxy)
      const res  = await apiPost("/api/resume/upload", form)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Upload failed")

      // Poll until ready
      await pollStatus(userId)

      // Mark onboarding complete
      await supabase.from("profiles").upsert(
        {
          user_id: userId,
          profile_data: {
            name:              name.trim(),
            phone:             phone.trim(),
            email:             userEmail,
            current_city:      currentCity.trim(),
            willing_to_relocate: willingToRelocate === "yes",
            preferred_roles:   selectedRoles,
            preferred_locations: selectedLocations,
            work_mode:         workMode,
            employment_type:   employmentType,
            experience_level:  expLevel,
            years_of_experience: yearsOfExp ? Number(yearsOfExp) : null,
            salary_min_inr:    salaryMin ? Number(salaryMin.replace(/,/g, "")) : null,
            salary_max_inr:    salaryMax ? Number(salaryMax.replace(/,/g, "")) : null,
            availability:      availability,
            work_authorization: workAuth,
            default_bio:       defaultBio.trim(),
            open_to_screening: openToScreening === "yes",
            onboarding_complete: true,
            resumes: [{ name: file.name, uploaded_at: new Date().toISOString() }],
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

      setTimeout(() => router.push("/dashboard/jobs"), 700)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Something went wrong")
      setUploadStage(-1)
    }
  }

  /* ─── render helpers ─────────────────────────────────────────────────────── */

  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100)

  const STEP_LABELS = [
    "Basics", "Your roles", "Location & work mode",
    "Experience", "Auto-apply prep", "Upload resume",
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-4">
        <Logo />
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-20 pt-10">

        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">
              Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// let's get started"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Who are you?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Basic info to personalise your experience.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Full name <span className="normal-case text-destructive">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace" className="mt-1.5" autoFocus />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Phone <span className="normal-case text-muted-foreground/50">(optional)</span>
                </Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Current city <span className="normal-case text-muted-foreground/50">(optional)</span>
                </Label>
                <Input value={currentCity} onChange={(e) => setCurrentCity(e.target.value)}
                  placeholder="Bangalore" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Open to relocation?
                </Label>
                <PillSelect
                  options={["yes", "no"] as const}
                  value={willingToRelocate}
                  onChange={setWillingToRelocate}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Preferred roles ── */}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// job preferences"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">What roles are you targeting?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Select as many as you like — these sharpen your matches.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ROLES.map((role) => (
                <Chip
                  key={role} label={role}
                  active={selectedRoles.includes(role)}
                  onClick={() => setSelectedRoles((prev) =>
                    prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                  )}
                />
              ))}
            </div>
            {selectedRoles.length > 0 && (
              <p className="font-mono text-xs text-muted-foreground">
                {selectedRoles.length} role{selectedRoles.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Location + work mode + employment type ── */}
        {step === 3 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// where & how"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Location & work preferences</h1>
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Preferred locations
              </Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_LOCATIONS.map((loc) => (
                  <Chip
                    key={loc} label={loc}
                    active={selectedLocations.includes(loc)}
                    onClick={() => setSelectedLocations((prev) =>
                      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
                    )}
                  />
                ))}
              </div>
              {selectedLocations.length > 0 && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {selectedLocations.length} selected
                </p>
              )}
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Work mode
              </Label>
              <PillSelect options={WORK_MODES} value={workMode} onChange={setWorkMode} />
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Employment type
              </Label>
              <PillSelect options={EMPLOYMENT_TYPES} value={employmentType} onChange={setEmploymentType} />
            </div>
          </div>
        )}

        {/* ── Step 4: Experience + salary ── */}
        {step === 4 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// experience & expectations"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Your experience & salary</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                All fields optional — used to sharpen match filtering.
              </p>
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Experience level
              </Label>
              <PillSelect options={EXP_LEVELS} value={expLevel} onChange={setExpLevel} />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Total years of experience
              </Label>
              <Input
                type="number" min={0} max={40}
                value={yearsOfExp}
                onChange={(e) => setYearsOfExp(e.target.value)}
                placeholder="e.g. 2"
                className="mt-1.5 max-w-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Min salary (₹/yr)
                </Label>
                <Input
                  value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="8,00,000" className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Max salary (₹/yr)
                </Label>
                <Input
                  value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="20,00,000" className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Availability / notice period
              </Label>
              <PillSelect options={AVAILABILITY_OPTS} value={availability} onChange={setAvailability} />
            </div>
          </div>
        )}

        {/* ── Step 5: Auto-apply prep ── */}
        {step === 5 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// for upcoming auto-apply"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Auto-apply prep</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We're collecting this now so the auto-apply engine can use it when it launches.
                Nothing is submitted anywhere yet.
              </p>
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Work authorization
              </Label>
              <PillSelect options={WORK_AUTH_OPTS} value={workAuth} onChange={setWorkAuth} />
            </div>

            <div>
              <Label className="mb-3 block text-xs uppercase tracking-widest text-muted-foreground">
                Willing to answer screening questions?
              </Label>
              <PillSelect
                options={["yes", "no"] as const}
                value={openToScreening}
                onChange={setOpenToScreening}
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Short "why this role" bio{" "}
                <span className="normal-case tracking-normal text-muted-foreground/50">(optional)</span>
              </Label>
              <p className="mt-1 text-xs text-muted-foreground/60">
                1-2 sentences about what you're looking for and what you bring. Used as a default answer.
              </p>
              <textarea
                value={defaultBio}
                onChange={(e) => setDefaultBio(e.target.value)}
                placeholder="I'm a backend engineer with 3 years in distributed systems, looking for roles where I can own infrastructure at scale..."
                maxLength={500}
                rows={4}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="mt-1 text-right font-mono text-xs text-muted-foreground/40">
                {defaultBio.length}/500
              </p>
            </div>
          </div>
        )}

        {/* ── Step 6: Resume upload ── */}
        {step === 6 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// final step"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Upload your resume</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                One AI pass extracts your skills and matches against 6,100+ jobs.
              </p>
            </div>

            {uploadStage === -1 && (
              <>
                {/* Drop zone */}
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    handleFileDrop(e.dataTransfer.files?.[0])
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/40 px-6 py-12 text-center transition-colors",
                    dragging && "border-primary bg-primary/5",
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="size-5" />
                  </span>
                  {file ? (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <FileUp className="size-4 text-primary" />
                      {file.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-medium">Drag & drop or click to browse</span>
                      <span className="text-xs text-muted-foreground">PDF, DOCX or TXT — max 5MB</span>
                    </>
                  )}
                  <input
                    ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="sr-only"
                    aria-label="Upload resume"
                    onChange={(e) => handleFileDrop(e.target.files?.[0])}
                  />
                </label>

                {uploadError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="size-4 shrink-0" />
                    {uploadError}
                  </div>
                )}

                <Button
                  onClick={runUpload}
                  disabled={!file}
                  className="h-11 w-full"
                >
                  Launch agent →
                </Button>
              </>
            )}

            {/* Pipeline progress */}
            {uploadStage >= 0 && (
              <ol className="space-y-3 py-2">
                {UPLOAD_STAGES.map((label, i) => {
                  const done   = i < uploadStage
                  const active = i === uploadStage
                  return (
                    <li key={label} className="flex items-center gap-3">
                      <span className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                        done   && "border-primary bg-primary text-primary-foreground",
                        active && "border-primary text-primary",
                        !done && !active && "border-border text-muted-foreground",
                      )}>
                        {done   ? <Check className="size-3.5" /> :
                         active ? <Loader2 className="size-3.5 animate-spin" /> :
                         i + 1}
                      </span>
                      <span className={cn(
                        "text-sm",
                        done || active ? "text-foreground" : "text-muted-foreground",
                      )}>
                        {label}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

        {/* Navigation — hidden during active upload */}
        {uploadStage === -1 && (
          <div className="mt-10 flex items-center justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={back}>
                <ChevronLeft className="mr-1 size-4" />
                Back
              </Button>
            ) : <div />}

            {step < TOTAL_STEPS && (
              <Button type="button" onClick={advance} disabled={saving}>
                {saving ? "Saving..." : "Continue"}
                <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
            {/* Step 6 navigation is handled by the drop zone / upload button */}
          </div>
        )}
      </div>
    </div>
  )
}
