import { CheckCircle2 } from "lucide-react"

function ResumeFace({ back = false }: { back?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl [backface-visibility:hidden]"
      style={back ? { transform: "rotateY(180deg)" } : undefined}
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="size-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/60" />
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded bg-foreground/80" />
          <div className="h-2 w-20 rounded bg-muted-foreground/50" />
        </div>
        <span className="ml-auto rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
          ATS 98%
        </span>
      </div>

      {/* skills */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["Python", "PyTorch", "FastAPI", "AWS", "ML"].map((s) => (
          <span key={s} className="rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
            {s}
          </span>
        ))}
      </div>

      {/* lines */}
      <div className="mt-5 space-y-3">
        {[100, 92, 80, 96, 70].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircle2 className="size-3 shrink-0 text-primary" />
            <div className="h-2 rounded bg-muted-foreground/30" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>

      <div className="mt-5 h-px bg-border" />
      <div className="mt-4 space-y-2.5">
        {[88, 64, 78].map((w, i) => (
          <div key={i} className="h-2 rounded bg-muted-foreground/20" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

export function RotatingResume() {
  return (
    <div className="relative [perspective:1400px]">
      {/* glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 scale-90 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="animate-float">
        <div className="relative h-[380px] w-[280px] animate-spin-y [transform-style:preserve-3d]">
          <ResumeFace />
          <ResumeFace back />
        </div>
      </div>
    </div>
  )
}
