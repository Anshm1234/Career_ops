"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const PAIN_POINTS = [
  {
    highlight: "Tab-hopping",
    rest: "across job platforms just to see what's out there?",
    align: "left" as const,
  },
  {
    highlight: "Keyword search",
    rest: "burying the right roles under a pile of irrelevant noise?",
    align: "right" as const,
  },
  {
    highlight: "No idea why",
    rest: "one job should rank above another — just a gut feel?",
    align: "left" as const,
  },
  {
    highlight: "Hours lost",
    rest: "manually tracking every application across scattered spreadsheets?",
    align: "right" as const,
  },
]

function PainPoint({
  highlight,
  rest,
  index,
  align,
}: {
  highlight: string
  rest: string
  index: number
  align: "left" | "right"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) { setVisible(true); return }

    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.3 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const isRight = align === "right"

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateX(0)"
          : isRight ? "translateX(48px)" : "translateX(-48px)",
        transition: `opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)`,
      }}
      className={cn(
        "group relative border-b border-border pb-10 pt-8",
        // Each block takes ~half the wider container, pushed to its edge
        "w-[52%]",
        isRight ? "ml-auto" : "mr-auto",
      )}
    >
      <div className={cn("flex flex-col gap-3", isRight ? "items-end text-right" : "items-start text-left")}>
        {/* Number */}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Big keyword */}
        <p className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl text-foreground">
          {highlight}
          <span className="text-muted-foreground/30">?</span>
        </p>

        {/* Context — bigger and more visible */}
        <p className="text-base leading-relaxed text-foreground/60 sm:text-lg">
          {rest}
        </p>
      </div>

      {/* Faded background number */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-4 font-mono text-[7rem] font-bold leading-none",
          "text-foreground/[0.03] select-none",
          isRight ? "right-0" : "left-0",
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  )
}

export function IsThisYou() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      {/* Heading */}
      <div className="mb-16 text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          sound familiar?
        </p>
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Is this you
          <span className="text-muted-foreground/30">?</span>
        </h2>
      </div>

      {/* Alternating pain points */}
      <div className="flex flex-col">
        {PAIN_POINTS.map((p, i) => (
          <PainPoint
            key={i}
            index={i}
            highlight={p.highlight}
            rest={p.rest}
            align={p.align}
          />
        ))}
      </div>

      {/* Resolution hook */}
      <p className="mt-12 text-center font-mono text-sm text-muted-foreground/40">
        {"// there's a better way"}
      </p>
    </section>
  )
}
