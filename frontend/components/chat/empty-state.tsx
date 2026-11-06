import { useTranslations } from "next-intl"

import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { brand } from "@/lib/brand"

// The starter prompts (messages → chat.suggestions.<key>). Picking one sends it in your language.
const SUGGESTIONS = ["split", "sets", "preRun"] as const

/** First screen of a new chat: logo, greeting and a few starter prompts. */
export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const t = useTranslations("chat")

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
      <LogoMark className="size-14 logo-glow" />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">{t("emptyTitle")}</h1>
        <p className="text-muted-foreground">{t("emptySubtitle", { coach: brand.coachName })}</p>
      </div>
      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((key) => (
          <Button
            key={key}
            variant="secondary"
            onClick={() => onPick(t(`suggestions.${key}`))}
            className="shine h-9 rounded-[10px] border px-3.5 text-muted-foreground hover:text-foreground"
          >
            {t(`suggestions.${key}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}
