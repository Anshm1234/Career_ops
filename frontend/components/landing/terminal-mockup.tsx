"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const LINES: { text: string; type: "cmd" | "ok" | "info" | "result" | "blank" }[] = [
  { text: "$ career-ops --upload resume.pdf",   type: "cmd"    },
  { text: "  parsing with Gemini...",           type: "info"   },
  { text: "  ✓ profile extracted",              type: "ok"     },
  { text: "    skills: Python, FastAPI, LLMs",  type: "info"   },
  { text: "    roles:  ML Engineer, Backend",   type: "info"   },
  { text: "",                                   type: "blank"  },
  { text: "$ career-ops --match --jobs 6100",   type: "cmd"    },
  { text: "  loading job index...",             type: "info"   },
  { text: "  running TOPSIS across 5 dims...",  type: "info"   },
  { text: "  ✓ ranked 6,100 jobs",              type: "ok"     },
  { text: "",                                   type: "blank"  },
  { text: "  top matches:",                     type: "info"   },
  { text: "  #1  ML Engineer    @ Perplexity  [score: 0.87]", type: "result" },
  { text: "  #2  Backend SWE    @ Razorpay    [score: 0.82]", type: "result" },
  { text: "  #3  AI Engineer    @ Sarvam      [score: 0.79]", type: "result" },
  { text: "  #4  SWE            @ Cursor      [score: 0.74]", type: "result" },
  { text: "",                                   type: "blank"  },
  { text: "  ✓ ready → career-ops.app/jobs",   type: "ok"     },
]

const TYPE_SPEED  = 22   // ms per char
const LINE_PAUSE  = 120  // ms between lines

interface TerminalMockupProps {
  className?: string
}

export function TerminalMockup({ className }: TerminalMockupProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [currentLine, setCurrentLine]       = useState(0)
  const [currentChar, setCurrentChar]       = useState(0)
  const [done, setDone]                     = useState(false)

  useEffect(() => {
    if (done) return
    if (currentLine >= LINES.length) { setDone(true); return }

    const line = LINES[currentLine]

    // Blank lines — just emit and move on
    if (line.type === "blank") {
      const pause = setTimeout(() => {
        setDisplayedLines((prev) => [...prev, ""])
        setCurrentLine((l) => l + 1)
        setCurrentChar(0)
      }, LINE_PAUSE / 2)
      return () => clearTimeout(pause)
    }

    // Still typing current line
    if (currentChar < line.text.length) {
      const t = setTimeout(() => setCurrentChar((c) => c + 1), TYPE_SPEED)
      return () => clearTimeout(t)
    }

    // Line complete — pause then move on
    const pause = setTimeout(() => {
      setDisplayedLines((prev) => [...prev, line.text])
      setCurrentLine((l) => l + 1)
      setCurrentChar(0)
    }, LINE_PAUSE)
    return () => clearTimeout(pause)
  }, [currentLine, currentChar, done])

  const inProgressText =
    currentLine < LINES.length && LINES[currentLine].type !== "blank"
      ? LINES[currentLine].text.slice(0, currentChar)
      : null

  function lineColor(type: string) {
    if (type === "cmd")    return "text-foreground"
    if (type === "ok")     return "text-emerald-400/80"
    if (type === "result") return "text-foreground/70"
    return "text-muted-foreground"
  }

  return (
    <div
      className={cn(
        "w-full max-w-lg rounded-2xl border border-border bg-[#0a0a0a] shadow-2xl shadow-black/40 overflow-hidden",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="size-3 rounded-full bg-border/60" />
        <span className="size-3 rounded-full bg-border/60" />
        <span className="size-3 rounded-full bg-border/60" />
        <span className="ml-3 font-mono text-xs text-muted-foreground/50">
          career-ops — terminal
        </span>
      </div>

      {/* Output */}
      <div className="min-h-[340px] p-5 font-mono text-[13px] leading-[1.65]">
        {displayedLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre",
              lineColor(LINES[i]?.type ?? "info"),
            )}
          >
            {line || " "}
          </div>
        ))}

        {/* Currently typing line */}
        {inProgressText !== null && (
          <div className={cn("whitespace-pre", lineColor(LINES[currentLine]?.type ?? "info"))}>
            {inProgressText}
            <span className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] animate-pulse bg-current align-middle opacity-80" />
          </div>
        )}

        {/* Idle cursor after done */}
        {done && (
          <div className="mt-1 text-foreground">
            {"$ "}
            <span className="ml-0.5 inline-block h-[0.85em] w-[2px] translate-y-[0.1em] animate-pulse bg-current align-middle opacity-60" />
          </div>
        )}
      </div>
    </div>
  )
}
