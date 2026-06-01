import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path
            d="M5 4h9a4 4 0 0 1 4 4v12l-4-3-4 3V8a4 4 0 0 0-4-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute inset-0 -z-10 rounded-lg bg-primary/40 blur-md" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight">
        Career<span className="text-primary">Ops</span>
      </span>
    </div>
  )
}
