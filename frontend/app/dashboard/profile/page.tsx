import { Briefcase, GraduationCap, Mail, MapPin, Phone, Sparkles } from "lucide-react"
import { FadeUpWords } from "@/components/animated-text"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const PROFILE = {
  name: "Ada Lovelace",
  title: "Machine Learning Engineer",
  email: "ada@example.com",
  phone: "+91 98765 43210",
  location: "Bangalore, India",
  education: "B.Tech, Computer Science",
  experienceYears: 2,
  skills: ["Python", "PyTorch", "FastAPI", "AWS", "Machine Learning", "Docker", "SQL", "Transformers"],
  searchKeywords: ["machine learning", "python", "pytorch", "llm", "mlops"],
  projects: [
    {
      name: "Career Ops Agent",
      description: "Autonomous job-application pipeline scraping 40+ portals with TOPSIS ranking.",
      tech: ["Python", "FastAPI", "Playwright"],
    },
    {
      name: "Resume Tailoring Engine",
      description: "LLM rewriter that aligns resume bullets to a target job description.",
      tech: ["Gemini", "Python"],
    },
  ],
  weights: [
    { label: "Skill match", value: 0.3 },
    { label: "Salary fit", value: 0.3 },
    { label: "Role match", value: 0.2 },
    { label: "Location", value: 0.1 },
    { label: "Seniority", value: 0.1 },
  ],
}

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="mb-2 font-mono text-sm text-primary">{"// parsed from resume.pdf"}</p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          <FadeUpWords text="Your profile" />
        </h1>
      </div>

      {/* Header card */}
      <div className="mb-6 flex flex-col items-start gap-5 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        <Avatar className="size-16 border border-border">
          <AvatarFallback className="bg-secondary text-lg font-medium">AL</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">{PROFILE.name}</h2>
          <p className="text-primary">{PROFILE.title}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {PROFILE.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {PROFILE.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {PROFILE.location}
            </span>
          </div>
        </div>
        <div className="flex gap-6 sm:flex-col sm:items-end">
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{PROFILE.experienceYears}y</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Experience</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Skills + projects */}
        <div className="space-y-6 lg:col-span-2">
          <Section title="Skills" icon={<Sparkles className="size-4 text-primary" />}>
            <div className="flex flex-wrap gap-2">
              {PROFILE.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-border bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Projects" icon={<Briefcase className="size-4 text-primary" />}>
            <div className="space-y-4">
              {PROFILE.projects.map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h4 className="font-medium">{p.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tech.map((t) => (
                      <span key={t} className="rounded bg-secondary px-2 py-0.5 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Section title="Education" icon={<GraduationCap className="size-4 text-primary" />}>
            <p className="text-sm text-foreground">{PROFILE.education}</p>
          </Section>

          <Section title="Ranking weights" icon={<Sparkles className="size-4 text-primary" />}>
            <div className="space-y-3">
              {PROFILE.weights.map((w) => (
                <div key={w.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{w.label}</span>
                    <span className="font-mono text-foreground">{w.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${w.value * 100 * 3.33}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Search keywords" icon={<Sparkles className="size-4 text-primary" />}>
            <div className="flex flex-wrap gap-1.5">
              {PROFILE.searchKeywords.map((k) => (
                <span
                  key={k}
                  className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary"
                >
                  {k}
                </span>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}
