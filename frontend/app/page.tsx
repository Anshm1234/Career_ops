/**
 * app/page.tsx — public marketing landing page.
 * Authenticated users are redirected away by middleware (to /onboarding or /dashboard).
 * Unauthenticated users see this page. All CTAs route to /login.
 */
import { LandingNavbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { IsThisYou } from "@/components/landing/is-this-you"
import { Features } from "@/components/landing/features"
import { HowItWorks } from "@/components/landing/how-it-works"
import { GlobeSection } from "@/components/landing/globe-section"
import { FooterCta } from "@/components/landing/footer-cta"

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <LandingNavbar />
      <Hero />
      <IsThisYou />
      <Features />
      <HowItWorks />
      <GlobeSection />
      <FooterCta />
    </div>
  )
}
