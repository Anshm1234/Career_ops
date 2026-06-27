"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

import dashboardImg from "@/screenshots/dashboard.png"
import uploadImg    from "@/screenshots/upload.png"
import jobCardsImg  from "@/screenshots/job_cards.png"
import profileImg   from "@/screenshots/profile.png"

const STEPS = [
  {
    num:   "01",
    label: "Add your profile",
    head:  "Sign in and drop your resume",
    body:  "Create an account, upload your resume (PDF or DOCX). One AI call extracts your skills, roles, location preferences, and search keywords.",
    img:   uploadImg,
    alt:   "Resume upload screen",
  },
  {
    num:   "02",
    label: "Get matched instantly",
    head:  "6,100+ jobs ranked for you",
    body:  "Your profile is matched against the full job index and ranked using TOPSIS across 5 dimensions. Results are ready in under a minute.",
    img:   jobCardsImg,
    alt:   "Matched jobs list",
  },
  {
    num:   "03",
    label: "See why each job fits",
    head:  "Every score is explained",
    body:  "Each job shows skill match, salary fit, role alignment, location score, and seniority score. No black box — every rank is visible.",
    img:   dashboardImg,
    alt:   "Job score breakdown",
  },
  {
    num:   "04",
    label: "Track applications",
    head:  "One place for the whole pipeline",
    body:  "Mark roles as saved, applied, interviewing, or offer. Keep notes per application alongside your matched results.",
    img:   profileImg,
    alt:   "Application tracker",
  },
]

/* ─── right-column step ──────────────────────────────────────────────────── */

function StepPanel({
  step,
  index,
  activeStep,
  onEnter,
}: {
  step: typeof STEPS[0]
  index: number
  activeStep: number
  onEnter: (i: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isActive = activeStep === index

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onEnter(index) },
      { threshold: 0.45, rootMargin: "-5% 0px -5% 0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [index, onEnter])

  return (
    <div
      ref={ref}
      className="relative flex min-h-[75vh] flex-col justify-center py-16 pl-12"
    >
      {/* Dot on the progress line */}
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full border-2 transition-all duration-400 z-10",
          isActive
            ? "border-foreground bg-foreground scale-125"
            : "border-border bg-background",
        )}
      />

      {/* Step content */}
      <div
        style={{
          opacity:   isActive ? 1 : 0.3,
          transform: isActive ? "none" : "translateX(8px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Step {step.num}
        </p>
        <h3 className="mb-4 text-2xl font-semibold tracking-tight lg:text-3xl">
          {step.head}
        </h3>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground lg:text-base lg:max-w-sm">
          {step.body}
        </p>
      </div>
    </div>
  )
}

/* ─── section ────────────────────────────────────────────────────────────── */

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)
  const [fillPct, setFillPct]       = useState(0)
  const [reduced, setReduced]       = useState(false)
  const rightColRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  /* scroll-driven line fill */
  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      const col = rightColRef.current
      if (!col) return
      const rect      = col.getBoundingClientRect()
      const midScreen = window.innerHeight * 0.5
      const scrolled  = -rect.top + midScreen
      const total     = col.scrollHeight - window.innerHeight * 0.5
      setFillPct(Math.max(0, Math.min(100, (scrolled / total) * 100)))
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [reduced])

  const handleEnter = useCallback((i: number) => setActiveStep(i), [])

  /* ── reduced-motion fallback ── */
  if (reduced) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-28">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">how it works</p>
        <h2 className="mb-12 text-4xl font-semibold tracking-tight sm:text-5xl">
          Four steps. <span className="text-muted-foreground/40">That's it.</span>
        </h2>
        <div className="space-y-16">
          {STEPS.map((s) => (
            <div key={s.num}>
              <p className="mb-1 font-mono text-xs text-muted-foreground">Step {s.num}</p>
              <h3 className="mb-2 text-xl font-semibold">{s.head}</h3>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section id="how-it-works" className="relative mx-auto max-w-6xl px-6" aria-label="How it works">
      <div className="grid grid-cols-2 gap-12">

        {/* LEFT — sticky panel */}
        <div className="relative">
          <div className="sticky top-0 flex h-screen flex-col justify-center gap-7 py-12">

            {/* Heading stays visible while scrolling */}
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                how it works
              </p>
              <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
                Four steps.{" "}
                <span className="text-muted-foreground/40">That's it.</span>
              </h2>
            </div>

            {/* Screenshot — cross-fades between steps */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-card">
              {STEPS.map((s, i) => (
                <div
                  key={s.num}
                  className="absolute inset-0"
                  style={{ opacity: activeStep === i ? 1 : 0, transition: "opacity 0.45s ease" }}
                >
                  <Image
                    src={s.img}
                    alt={s.alt}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 45vw"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>

            {/* Step nav indicators */}
            <div className="flex gap-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.num}
                  className={cn(
                    "flex flex-1 flex-col gap-1 border-t-2 pt-2.5 transition-colors duration-400",
                    activeStep === i ? "border-foreground" : "border-border",
                  )}
                >
                  <span className={cn(
                    "font-mono text-[10px] transition-colors duration-400",
                    activeStep === i ? "text-foreground" : "text-muted-foreground/30",
                  )}>
                    {s.num}
                  </span>
                  <span className={cn(
                    "text-[11px] leading-snug transition-colors duration-400",
                    activeStep === i ? "text-foreground/70" : "text-muted-foreground/25",
                  )}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — scrolling steps with progress line */}
        <div ref={rightColRef} className="relative">

          {/* Vertical track (full height) */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

          {/* Animated fill line */}
          <div
            className="absolute left-0 top-0 w-px bg-foreground origin-top"
            style={{
              height:     `${fillPct}%`,
              transition: "height 0.1s linear",
            }}
          />

          {STEPS.map((s, i) => (
            <StepPanel
              key={s.num}
              step={s}
              index={i}
              activeStep={activeStep}
              onEnter={handleEnter}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
