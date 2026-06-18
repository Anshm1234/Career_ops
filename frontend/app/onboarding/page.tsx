"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { PREDEFINED_ROLES, PREDEFINED_LOCATIONS } from "@/lib/onboarding-options"

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [userId, setUserId] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  // Multi-select: users can pick as many roles/locations as they want
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/"); return }
      setUserId(user.id)
      // Pre-fill name from OAuth metadata (Google/GitHub)
      const meta = user.user_metadata
      setName(meta?.full_name || meta?.name || "")
      // Skip onboarding if already complete
      supabase.from("profiles").select("profile_data").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.profile_data?.onboarding_complete) router.replace("/dashboard")
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(value: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function advance() {
    if (step === 1 && !name.trim()) { setError("Please enter your name"); return }
    if (step === 2 && selectedRoles.length === 0) { setError("Please select at least one role"); return }
    setError("")
    setStep((s) => (s + 1) as Step)
  }

  function back() {
    setError("")
    setStep((s) => (s - 1) as Step)
  }

  async function handleComplete() {
    if (selectedLocations.length === 0) { setError("Please select at least one location"); return }
    setSaving(true)
    setError("")

    // All onboarding data lives inside profile_data jsonb (matches existing schema)
    const { error: dbErr } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        profile_data: {
          name: name.trim(),
          phone: phone.trim(),
          preferred_roles: selectedRoles,
          preferred_locations: selectedLocations,
          onboarding_complete: true,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-6 py-4">
        <Logo />
      </div>

      <div className="mx-auto w-full max-w-2xl px-6 pt-10 pb-20">
        {/* Step indicator */}
        <div className="mb-10 flex items-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  s < step
                    ? "bg-primary text-primary-foreground"
                    : s === step
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                )}
              >
                {s < step ? <Check className="size-3.5" /> : s}
              </div>
              {s < 3 && (
                <div className={cn("h-px w-10", s < step ? "bg-primary" : "bg-border")} />
              )}
            </div>
          ))}
          <span className="ml-3 font-mono text-xs text-muted-foreground">Step {step} of 3</span>
        </div>

        {/* ── Step 1: Name + Phone ── */}
        {step === 1 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// let's get started"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Who are you?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This personalises your Career Ops dashboard.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Full name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Phone{" "}
                  <span className="normal-case tracking-normal text-muted-foreground/50">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Preferred roles (multi-select) ── */}
        {step === 2 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// job preferences"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">What roles are you targeting?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Select as many as you like — these sharpen your job matches.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ROLES.map((role) => {
                const active = selectedRoles.includes(role)
                return (
                  <button
                    key={role}
                    onClick={() => toggle(role, selectedRoles, setSelectedRoles)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:border-primary/40",
                    )}
                  >
                    {active && <Check className="mr-1.5 inline size-3" />}
                    {role}
                  </button>
                )
              })}
            </div>

            {selectedRoles.length > 0 && (
              <p className="font-mono text-xs text-muted-foreground">
                {selectedRoles.length} role{selectedRoles.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* ── Step 3: Preferred locations (multi-select) ── */}
        {step === 3 && (
          <div className="space-y-7">
            <div>
              <p className="mb-1 font-mono text-xs text-primary">{"// location preferences"}</p>
              <h1 className="text-3xl font-semibold tracking-tight">Where do you want to work?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Select as many as you like — cities, remote, or anywhere.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PREDEFINED_LOCATIONS.map((loc) => {
                const active = selectedLocations.includes(loc)
                return (
                  <button
                    key={loc}
                    onClick={() => toggle(loc, selectedLocations, setSelectedLocations)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:border-primary/40",
                    )}
                  >
                    {active && <Check className="mr-1.5 inline size-3" />}
                    {loc}
                  </button>
                )
              })}
            </div>

            {selectedLocations.length > 0 && (
              <p className="font-mono text-xs text-muted-foreground">
                {selectedLocations.length} location{selectedLocations.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* Error message */}
        {error && <p className="mt-5 text-sm text-red-400">{error}</p>}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={back}>
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button onClick={advance}>
              Continue
              <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={saving}>
              {saving ? "Saving..." : "Complete setup →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
