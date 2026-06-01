import { FadeUpWords, RotatingWords } from "@/components/animated-text"
import { DashboardActions } from "@/components/dashboard/dashboard-actions"
import { DotGlobeHero } from "@/components/ui/globe-hero"

const STATS = [
  { label: "Portals scanned", value: "42" },
  { label: "Roles matched",   value: "57" },
  { label: "Auto-applied",    value: "23" },
]

export default function DashboardHome() {
  return (
    <main className="relative mx-auto max-w-7xl px-6">
      <div
        aria-hidden="true"
        className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <div className="relative grid min-h-[calc(100vh-4rem)] grid-cols-1 items-stretch gap-8 py-10 lg:grid-cols-2">
        <div className="flex flex-col justify-between">
          <div className="flex flex-1 flex-col justify-center">
            <p className="mb-4 font-mono text-sm text-primary">
              <FadeUpWords text="// welcome back, Ansh" />
            </p>
            <h1 className="text-balance text-6xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
              Career<span className="text-primary">Ops</span>
            </h1>
            <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              Your autonomous job-application agent is{" "}
              <RotatingWords
                words={["scanning portals", "ranking roles", "tailoring resumes", "applying for you"]}
                className="font-medium text-foreground"
              />
            </p>
            <div className="mt-8 flex flex-wrap gap-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-semibold tabular-nums">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DashboardActions />
        </div>
        <div className="relative flex min-h-[24rem] items-center justify-center">
          <DotGlobeHero
            rotationSpeed={0.004}
            dotCount={2800}
            className="absolute inset-0 h-full [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]"
          />
        </div>
      </div>
    </main>
  )
}