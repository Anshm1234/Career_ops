import { ScrollFadeIn } from "@/components/landing/scroll-fade-in"

const FREE_FEATURES = [
  "6,100+ jobs indexed from Greenhouse, Lever & Ashby",
  "AI resume parsing (one Gemini call per upload)",
  "TOPSIS ranking across 5 dimensions",
  "Resume tailoring per job description (3/day)",
  "Application tracker",
]

const PREMIUM_HINTS = [
  "Live scraping from additional sources",
  "Internshala + more portals via Apify",
  "Unlimited resume tailoring",
  "Priority re-ranking on profile update",
]

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-5xl px-6 py-28">
      <ScrollFadeIn className="mb-14 text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          pricing
        </p>
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Free to start.{" "}
          <span className="text-muted-foreground/40">More coming.</span>
        </h2>
      </ScrollFadeIn>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Free tier */}
        <ScrollFadeIn delay={0} className="flex flex-col rounded-2xl border border-border bg-card p-7">
          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free</p>
            <div className="mt-2 flex items-end gap-1.5">
              <span className="text-4xl font-semibold">₹0</span>
              <span className="mb-1 text-sm text-muted-foreground">/ forever</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything you need to discover and match to the right roles.
            </p>
          </div>

          <ul className="flex flex-1 flex-col gap-3">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 text-foreground/50">✓</span>
                <span className="text-foreground/80">{f}</span>
              </li>
            ))}
          </ul>

          <a
            href="/login"
            className="mt-8 block rounded-xl border border-border py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary"
          >
            Get started free
          </a>
        </ScrollFadeIn>

        {/* Premium teaser */}
        <ScrollFadeIn delay={100} className="relative flex flex-col rounded-2xl border border-border bg-card p-7 overflow-hidden">
          {/* Coming soon overlay */}
          <div className="absolute inset-0 rounded-2xl bg-background/60 backdrop-blur-[2px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 w-fit rounded-full border border-dashed border-border px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Coming soon
              </div>
              <p className="text-sm text-muted-foreground">
                Premium tier with live scraping &amp; more sources
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground/50">
                Powered by Apify · Razorpay payments
              </p>
            </div>
          </div>

          {/* Blurred content underneath */}
          <div className="select-none blur-sm pointer-events-none">
            <div className="mb-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pro</p>
              <div className="mt-2 flex items-end gap-1.5">
                <span className="text-4xl font-semibold">₹???</span>
                <span className="mb-1 text-sm text-muted-foreground">/ month</span>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {PREMIUM_HINTS.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 text-foreground/50">✓</span>
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollFadeIn>

      </div>
    </section>
  )
}
