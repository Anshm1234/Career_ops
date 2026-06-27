import { DotGlobeHero } from "@/components/ui/globe-hero"
import { ScrollFadeIn } from "@/components/landing/scroll-fade-in"

export function GlobeSection() {
  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-6 py-28">
      <ScrollFadeIn className="mb-10 text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          coverage
        </p>
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Roles aggregated{" "}
          <span className="text-muted-foreground/40">from across the ecosystem.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
          Greenhouse, Lever, Ashby, and Internshala — one index, refreshed daily,
          matched against your profile the moment you upload.
        </p>
      </ScrollFadeIn>

      {/* Globe */}
      <ScrollFadeIn direction="none" threshold={0.1} className="relative mx-auto h-[420px] max-w-2xl">
        <DotGlobeHero
          rotationSpeed={0.003}
          dotCount={2400}
          className="absolute inset-0 h-full [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
        />

        {/* Floating source chips */}
        {[
          { label: "Greenhouse",   style: "top-[15%] left-[8%]"  },
          { label: "Lever",        style: "top-[10%] right-[12%]" },
          { label: "Ashby",        style: "bottom-[20%] left-[10%]" },
          { label: "Internshala",  style: "bottom-[18%] right-[8%]" },
        ].map((s) => (
          <span
            key={s.label}
            className={`absolute ${s.style} rounded-full border border-border bg-background/80 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm`}
          >
            {s.label}
          </span>
        ))}
      </ScrollFadeIn>
    </section>
  )
}
