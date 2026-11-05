import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { brand } from "@/lib/brand"

const SUGGESTIONS = [
  "I can train 4 days a week. Build me a split.",
  "How many sets per muscle should I do?",
  "What should I eat before a run?",
]

/** First screen of a new chat: logo, greeting and a few starter prompts. */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <LogoMark className="size-14 logo-glow" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">What are we training today?</h1>
        <p className="text-muted-foreground">{`Strength, speed, running, recovery. Ask ${brand.coachName} anything.`}</p>
      </div>
      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} variant="secondary" onClick={() => onPick(s)} className="shine h-9 rounded-[10px] border px-3.5 text-muted-foreground hover:text-foreground">
            {s}
          </Button>
        ))}
      </div>
    </div>
  )
}
