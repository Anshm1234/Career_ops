"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, FileUp, Loader2, UploadCloud, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { apiPost, apiGet } from "@/lib/api"
import { cn } from "@/lib/utils"

const STEPS = [
  "Parsing resume with AI",
  "Scraping 40+ company portals",
  "Filtering & ranking matches",
  "Done — matches ready",
]

const WEIGHTS = [
  { key: "weight_skill",     label: "Skill match",  defaultVal: 30 },
  { key: "weight_salary",    label: "Salary fit",   defaultVal: 30 },
  { key: "weight_role",      label: "Role match",   defaultVal: 20 },
  { key: "weight_location",  label: "Location",     defaultVal: 10 },
  { key: "weight_seniority", label: "Seniority",    defaultVal: 10 },
]

export function UploadResumeDialog({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open,     setOpen]     = useState(false)
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState<File | null>(null)
  const [step,     setStep]     = useState(-1)
  const [error,    setError]    = useState<string | null>(null)

  // form fields
  const [roles,  setRoles]  = useState("")
  const [loc,    setLoc]    = useState("")
  const [smin,   setSmin]   = useState("")
  const [smax,   setSmax]   = useState("")
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(WEIGHTS.map((w) => [w.key, w.defaultVal]))
  )

  const running = step > -1

  function handleFile(f?: File | null) {
    if (f) setFile(f)
  }

  async function pollStatus(userId: string) {
    const interval = setInterval(async () => {
      try {
        const res  = await apiGet(`/api/jobs/status/${userId}`)
        const data = await res.json()

        if (data.status === "filtering") setStep(2)
        if (data.status === "ready") {
          clearInterval(interval)
          setStep(3)
          setTimeout(() => {
            setOpen(false)
            router.push("/dashboard/jobs")
          }, 800)
        }
        if (data.status === "failed") {
          clearInterval(interval)
          setError(`Scrape failed: ${data.detail}`)
          setStep(-1)
        }
      } catch {
        clearInterval(interval)
        setError("Lost connection to backend")
        setStep(-1)
      }
    }, 2000)
  }

  async function runPipeline() {
    if (!file) return
    setError(null)
    setStep(0)

    try {
      // Get real Supabase user ID to use as the session key
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in — please refresh and sign in again")

      const form = new FormData()
      form.append("file", file)
      if (roles) form.append("preferred_roles", roles)
      if (loc)   form.append("location_preferences", loc)
      if (smin)  form.append("salary_min", smin.replace(/,/g, ""))
      if (smax)  form.append("salary_max", smax.replace(/,/g, ""))
      Object.entries(weights).forEach(([k, v]) =>
        form.append(k, String(v / 100))
      )

      setStep(1)
      const res  = await apiPost("/api/resume/upload", form)
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || "Upload failed")

      // Store real Supabase user ID so jobs page can fetch results
      localStorage.setItem("career_ops_user_id", user.id)
      pollStatus(user.id)

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep(-1)
    }
  }

  function reset() {
    setStep(-1)
    setFile(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload your resume</DialogTitle>
          <DialogDescription>
            We&apos;ll parse it once, then the agent handles discovery, ranking, and applying.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!running ? (
          <div className="flex flex-col gap-4">
            {/* Drop zone */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center transition-colors",
                dragging && "border-primary bg-primary/5",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="size-5" />
              </span>
              {file ? (
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileUp className="size-4 text-primary" />
                  {file.name}
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">Drag & drop or click to browse</span>
                  <span className="text-xs text-muted-foreground">PDF, DOCX or TXT — max 5MB</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                aria-label="Upload resume file"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>

            {/* Preferences */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="roles" className="text-xs text-muted-foreground">Preferred roles</Label>
                <Input id="roles" placeholder="ML Engineer" value={roles} onChange={(e) => setRoles(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loc" className="text-xs text-muted-foreground">Location</Label>
                <Input id="loc" placeholder="Remote, Bangalore" value={loc} onChange={(e) => setLoc(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smin" className="text-xs text-muted-foreground">Min salary (₹/yr)</Label>
                <Input id="smin" placeholder="8,00,000" value={smin} onChange={(e) => setSmin(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="smax" className="text-xs text-muted-foreground">Max salary (₹/yr)</Label>
                <Input id="smax" placeholder="20,00,000" value={smax} onChange={(e) => setSmax(e.target.value)} />
              </div>
            </div>

            {/* TOPSIS weight sliders */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Ranking weights</p>
              {WEIGHTS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground">{label}</span>
                  <input
                    type="range"
                    aria-label={label}
                    min={0} max={100} step={5}
                    value={weights[key]}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="flex-1 accent-primary h-1 cursor-pointer"
                  />
                  <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                    {weights[key]}%
                  </span>
                </div>
              ))}
            </div>

            <Button onClick={runPipeline} disabled={!file} className="h-11">
              Launch agent
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col gap-3 py-2">
            {STEPS.map((label, i) => {
              const done   = i < step
              const active = i === step
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
                    "text-sm transition-colors",
                    done || active ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
