import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ScrollFadeIn } from "@/components/landing/scroll-fade-in"

const FOOTER_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features",     href: "#features"     },
  { label: "Pricing",      href: "#pricing"       },
  { label: "Sign in",      href: "/login"         },
]

export function FooterCta() {
  return (
    <footer className="border-t border-border">
      {/* Final CTA block */}
      <div className="mx-auto max-w-4xl px-6 py-28 text-center">
        <ScrollFadeIn>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            ready?
          </p>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Stop tab-hopping.
            <br />
            <span className="text-muted-foreground/40">Start matching.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-sm text-base leading-relaxed text-muted-foreground">
            Upload your resume once. Career Ops handles the rest — aggregating,
            ranking, and delivering the roles that actually fit.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              Try Career Ops — it&apos;s free
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <p className="mt-4 font-mono text-xs text-muted-foreground/40">
            No credit card. No setup. Just upload.
          </p>
        </ScrollFadeIn>
      </div>

      {/* Footer bar */}
      <div className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="font-semibold tracking-tight text-sm">
            Career<span className="text-primary">Ops</span>
          </span>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <p className="font-mono text-xs text-muted-foreground/40">
            © {new Date().getFullYear()} Career Ops
          </p>
        </div>
      </div>
    </footer>
  )
}
