"use client"

import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"
import { FadeUpWords, RotatingWords } from "@/components/animated-text"
import { TerminalMockup } from "@/components/landing/terminal-mockup"
import { ScrollFadeIn } from "@/components/landing/scroll-fade-in"

const STATS = [
  "6,100+ jobs indexed",
  "4 sources",
  "ranked across 5 dimensions",
]

export function Hero() {
  function scrollToHowItWorks(e: React.MouseEvent) {
    e.preventDefault()
    document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20
          [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)]
          [background-size:48px_48px]
          [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-40 pb-20 lg:grid-cols-2 lg:pt-44">
        {/* Left — text */}
        <ScrollFadeIn direction="none" threshold={0.05} className="flex flex-col">
          {/* Eyebrow */}
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <FadeUpWords text="AI Job Matching" />
          </p>

          {/* Headline */}
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            <FadeUpWords text="Every relevant role," delay={0.1} />
            <br />
            <span className="text-muted-foreground/60">
              <RotatingWords
                words={["ranked for you.", "matched to you.", "scored for you.", "ready for you."]}
              />
            </span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Career Ops aggregates jobs from across the ecosystem and ranks them
            against your resume — one upload, zero tab-hopping.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how-it-works"
              onClick={scrollToHowItWorks}
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              See how it works
              <ChevronDown className="size-4" />
            </a>
          </div>

          {/* Real stats strip */}
          <div className="mt-10 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground/60">
            {STATS.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">·</span>}
                {s}
              </span>
            ))}
          </div>
        </ScrollFadeIn>

        {/* Right — terminal mockup */}
        <ScrollFadeIn direction="none" threshold={0.05} delay={100} className="flex justify-center lg:justify-end">
          <div className="relative w-full max-w-lg">
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-3xl bg-foreground/[0.03] blur-3xl"
            />
            <TerminalMockup className="relative" />
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  )
}
