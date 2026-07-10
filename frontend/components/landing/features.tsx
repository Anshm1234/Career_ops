"use client"

import { ScrollFadeIn, useVisible } from "@/components/landing/scroll-fade-in"
import { cn } from "@/lib/utils"

/* ─── mock data ──────────────────────────────────────────────────────────── */

const MOCK_JOBS = [
  { title: "ML Engineer",    company: "Perplexity",  loc: "Remote",     score: "0.87", tag: "BEST" },
  { title: "Backend SWE",    company: "Razorpay",    loc: "Bengaluru",  score: "0.82", tag: null   },
  { title: "AI Engineer",    company: "Sarvam",      loc: "Bengaluru",  score: "0.79", tag: null   },
]

const PARSED_FIELDS = [
  { label: "SKILLS",   value: "Python · FastAPI · LLMs · PyTorch" },
  { label: "ROLES",    value: "ML Engineer · Backend SWE"         },
  { label: "LOCATION", value: "Bangalore · Remote (India)"        },
  { label: "KEYWORDS", value: "machine learning · llm · api"      },
]

const TOPSIS_DIMS = [
  { label: "Skill",     pct: 88 },
  { label: "Salary",    pct: 74 },
  { label: "Role",      pct: 95 },
  { label: "Location",  pct: 62 },
  { label: "Seniority", pct: 80 },
]

const PIPELINE = [
  { stage: "Saved",    count: 18 },
  { stage: "Applied",  count: 11 },
  { stage: "Screening",count: 5  },
  { stage: "Offer",    count: 1  },
]

/* ─── shared card shell ──────────────────────────────────────────────────── */

function CardShell({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <ScrollFadeIn delay={delay} className={cn("flex flex-col rounded-2xl border border-border bg-card overflow-hidden", className)}>
      {children}
    </ScrollFadeIn>
  )
}

/* ─── Card 1: multi-source ───────────────────────────────────────────────── */

function CardMultiSource() {
  const { ref, visible } = useVisible(0.25)

  return (
    <CardShell delay={0} className="col-span-2">
      <div ref={ref} className="flex flex-1 flex-col p-6 gap-4">
        {/* Mockup: staggered job rows */}
        <div className="flex flex-col gap-2.5">
          {MOCK_JOBS.map((job, i) => (
            <div
              key={job.title}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2.5"
              style={{
                opacity:   visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.4s ease ${i * 110}ms, transform 0.4s ease ${i * 110}ms`,
              }}
            >
              <div className="size-4 rounded-lg border border-border bg-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{job.title}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">{job.company} · {job.loc}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {job.tag && (
                  <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 font-mono text-[9px] text-foreground/60">
                    {job.tag}
                  </span>
                )}
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{job.score}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer text */}
        <div className="mt-auto pt-2 border-t border-border">
          <p className="text-sm font-semibold">Multi-source aggregation</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Greenhouse, Lever, Ashby &amp; Internshala — one ranked feed.
          </p>
        </div>
      </div>
    </CardShell>
  )
}

/* ─── Card 2: AI parsing ─────────────────────────────────────────────────── */

function CardAIParsing() {
  const { ref, visible } = useVisible(0.25)

  return (
    <CardShell delay={100} className="col-span-2">
      <div ref={ref} className="flex flex-1 flex-col p-6 gap-4">
        {/* Mockup: fields populating */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
          {PARSED_FIELDS.map((f, i) => (
            <div
              key={f.label}
              style={{
                opacity:   visible ? 1 : 0,
                transition: `opacity 0.45s ease ${i * 120}ms`,
              }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                {f.label}
              </span>
              <p className="text-[11px] text-foreground/80 leading-snug">{f.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-2 border-t border-border">
          <p className="text-sm font-semibold">AI resume parsing</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            One upload, one AI call — profile extracted and ready to match.
          </p>
        </div>
      </div>
    </CardShell>
  )
}

/* ─── Card 3: TOPSIS ─────────────────────────────────────────────────────── */

function CardTopsis() {
  const { ref, visible } = useVisible(0.25)

  return (
    <CardShell delay={200} className="col-span-2">
      <div ref={ref} className="flex flex-1 flex-col p-6 gap-4">
        {/* Mockup: bars filling */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
          {TOPSIS_DIMS.map((d, i) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {d.label}
              </span>
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{
                    width: visible ? `${d.pct}%` : "0%",
                    transition: `width 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
                  }}
                />
              </div>
              <span
                className="w-6 text-right font-mono text-[10px] tabular-nums text-muted-foreground"
                style={{ opacity: visible ? 1 : 0, transition: `opacity 0.4s ease ${i * 80 + 400}ms` }}
              >
                {d.pct}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-2 border-t border-border">
          <p className="text-sm font-semibold">Explainable TOPSIS ranking</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            5 dimensions, every score visible — no black box.
          </p>
        </div>
      </div>
    </CardShell>
  )
}

/* ─── Card 4: tracker ────────────────────────────────────────────────────── */

function CardTracker() {
  const { ref, visible } = useVisible(0.25)

  return (
    <CardShell delay={0} className="col-span-3">
      <div ref={ref} className="flex flex-1 flex-col p-6 gap-4">
        {/* Mockup: pipeline stages */}
        <div className="flex items-center gap-2">
          {PIPELINE.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-2 flex-1">
              <div
                className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-background/60 p-3 text-center"
                style={{
                  opacity:   visible ? 1 : 0,
                  transform: visible ? "scale(1)" : "scale(0.92)",
                  transition: `opacity 0.4s ease ${i * 90}ms, transform 0.4s ease ${i * 90}ms`,
                }}
              >
                <span className="font-mono text-xl font-semibold tabular-nums text-foreground">{s.count}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.stage}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <div
                  className="h-px flex-shrink-0 w-4 bg-border"
                  style={{ opacity: visible ? 1 : 0, transition: `opacity 0.3s ease ${i * 90 + 200}ms` }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto pt-2 border-t border-border">
          <p className="text-sm font-semibold">Application tracker</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track every application across stages — status, dates, notes in one place.
          </p>
        </div>
      </div>
    </CardShell>
  )
}

/* ─── Card 5: resume tailoring (live — hover reveals how to use it) ───────── */

function CardTailoring() {
  return (
    <CardShell delay={120} className="col-span-3 group relative overflow-hidden">
      <div className="flex flex-1 flex-col p-6 gap-4">
        {/* Mockup content — un-blurs on hover */}
        <div className="relative rounded-xl border border-border bg-background/60 p-4 select-none">
          <div className="blur-sm pointer-events-none space-y-2 transition-all duration-300 group-hover:blur-none group-hover:opacity-40">
            <div className="h-2.5 w-3/4 rounded bg-foreground/10" />
            <div className="h-2.5 w-full rounded bg-foreground/10" />
            <div className="h-2.5 w-2/3 rounded bg-foreground/10" />
            <div className="mt-3 h-2.5 w-full rounded bg-foreground/10" />
            <div className="h-2.5 w-4/5 rounded bg-foreground/10" />
          </div>
          {/* Hover-responsive pill: "tailor resume" → "select a job" */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl">
            <div className="rounded-full border border-border bg-background px-4 py-1.5 font-mono text-xs text-muted-foreground transition-colors duration-300 group-hover:border-foreground/30 group-hover:text-foreground">
              <span className="group-hover:hidden">tailor resume</span>
              <span className="hidden group-hover:inline">select a job →</span>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Resume tailoring</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rewrites your bullets to align with a target job — before you apply.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/60">
              Live
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  )
}

/* ─── section ────────────────────────────────────────────────────────────── */

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-28">
      <ScrollFadeIn className="mb-12">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          capabilities
        </p>
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          One tool.{" "}
          <span className="text-muted-foreground/40">The whole search.</span>
        </h2>
      </ScrollFadeIn>

      {/* Grid: 6-col base → row 1: 3×col-span-2 · row 2: 2×col-span-3 */}
      <div className="grid grid-cols-6 gap-4">
        <CardMultiSource />
        <CardAIParsing  />
        <CardTopsis     />
        <CardTracker    />
        <CardTailoring  />
      </div>
    </section>
  )
}
