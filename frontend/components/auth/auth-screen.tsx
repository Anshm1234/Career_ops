"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Eye, EyeOff, Github, Loader2, Mail, Lock, User, AlertCircle } from "lucide-react"
import { Logo } from "@/components/logo"
import { RotatingWords } from "@/components/animated-text"
import { DotGlobeHero } from "@/components/ui/globe-hero"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const COMPANIES = [
  "Anthropic", "Spotify", "Stripe", "Cursor", "Perplexity",
  "Duolingo", "Coinbase", "DoorDash", "Mistral", "Replit", "Groq", "Lyft",
]

// When true, the auth screen still renders fully, but any sign-in/sign-up
// button press skips Supabase and lands directly on the dashboard.
// Toggle via NEXT_PUBLIC_DEMO_MODE=true in the environment.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

// Messages for ?error= codes set by middleware / auth routes.
const URL_ERRORS: Record<string, string> = {
  session_expired: "Your session has expired — please sign in again.",
  confirm_expired: "That confirmation link is invalid or has expired. Try signing in — if that fails, sign up again to get a fresh link.",
  confirm:         "Invalid confirmation link.",
  auth:            "Authentication failed — please sign in.",
}

export function AuthScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode]               = useState<"login" | "signup">("login")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Surface middleware/auth-route errors (e.g. expired session) on arrival.
  useEffect(() => {
    const code = searchParams.get("error")
    if (code && URL_ERRORS[code]) setError(URL_ERRORS[code])
  }, [searchParams])

  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Demo bypass — skip auth entirely, go straight to dashboard.
    if (DEMO_MODE) {
      router.push("/dashboard")
      router.refresh()
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push("/dashboard")
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setError("Check your email for a confirmation link.")
        setLoading(false)
        return
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  async function handleGitHub() {
    if (DEMO_MODE) { router.push("/dashboard"); router.refresh(); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleGoogle() {
    if (DEMO_MODE) { router.push("/dashboard"); router.refresh(); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-0 size-[36rem] rounded-full bg-primary/10 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-0 size-[32rem] rounded-full bg-accent/10 blur-[120px]" />

      {/* Left brand panel */}
      <section className="relative hidden w-1/2 flex-col justify-between border-r border-border p-12 lg:flex">
        <div className="absolute inset-0 opacity-70" aria-hidden="true">
          <DotGlobeHero
            rotationSpeed={0.0035}
            dotCount={2400}
            className="h-full [mask-image:radial-gradient(circle_at_60%_50%,black,transparent_72%)]"
          />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/60 via-background/20 to-background/70" />
        <div className="relative z-10 flex items-center justify-between">
          <Logo />
          <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
            v1.0 · agent online
          </span>
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="mb-4 font-mono text-sm text-primary">{"// autonomous job pipeline"}</p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight">
            Drop your resume.
            <br />
            We&apos;ll handle the{" "}
            <RotatingWords
              words={["scraping.", "ranking.", "tailoring.", "applying."]}
              className="text-primary"
            />
          </h1>
          <p className="mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground">
            Career Ops scans 40+ company portals, scores every listing with a custom ranking engine,
            and auto-applies on your behalf.
          </p>
        </div>
        <div className="relative z-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Sourcing roles from</p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max animate-marquee gap-3">
              {[...COMPANIES, ...COMPANIES].map((c, i) => (
                <span key={i} className="whitespace-nowrap rounded-full border border-border bg-card/60 px-4 py-1.5 text-sm text-foreground/80">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Right auth panel */}
      <section className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>

          <div className="relative mb-8 grid grid-cols-2 rounded-xl border border-border bg-card/60 p-1 text-sm font-medium">
            <span
              className={cn(
                "absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-lg bg-primary transition-transform duration-300 ease-out",
                mode === "signup" && "translate-x-[calc(100%+0.5rem)]",
              )}
              aria-hidden="true"
            />
            <button type="button" onClick={() => { setMode("login"); setError(null) }}
              className={cn("relative z-10 rounded-lg py-2 transition-colors", mode === "login" ? "text-primary-foreground" : "text-muted-foreground")}>
              Sign in
            </button>
            <button type="button" onClick={() => { setMode("signup"); setError(null) }}
              className={cn("relative z-10 rounded-lg py-2 transition-colors", mode === "signup" ? "text-primary-foreground" : "text-muted-foreground")}>
              Create account
            </button>
          </div>

          {error && (
            <div className={cn(
              "mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
              error.includes("Check your email")
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            )}>
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div key={mode} className="animate-fade-up">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Start applying on autopilot"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to resume your job hunt." : "Create an account — no credit card needed."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              {mode === "signup" && (
                <Field id="name" label="Full name" icon={<User className="size-4" />}>
                  <Input id="name" placeholder="Ada Lovelace" required className="pl-10"
                    value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field id="email" label="Email" icon={<Mail className="size-4" />}>
                <Input id="email" type="email" placeholder="you@example.com" required className="pl-10"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field id="password" label="Password" icon={<Lock className="size-4" />}>
                <Input id="password" type={showPassword ? "text" : "password"}
                  placeholder="••••••••" required className="px-10"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </Field>

              <Button type="submit" disabled={loading} className="group mt-2 h-11 text-sm font-medium">
                {loading ? (
                  <><Loader2 className="size-4 animate-spin" />{mode === "login" ? "Signing in…" : "Creating account…"}</>
                ) : (
                  <>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>
                )}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleGitHub} disabled={loading}
                className="h-11 flex-1 bg-transparent text-sm">
                <Github className="size-4" />GitHub
              </Button>
              <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading}
                className="h-11 flex-1 bg-transparent text-sm">
                <svg className="size-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </Button>
            </div>

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <span className="text-foreground/80 underline underline-offset-4">Terms</span> and{" "}
              <span className="text-foreground/80 underline underline-offset-4">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function Field({ id, label, icon, children }: {
  id: string; label: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  )
}