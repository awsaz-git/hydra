"use client"

import { useTranslations } from "next-intl"

import { useSettled } from "@/hooks/use-settled"
import { LEVELS, type Level } from "@/lib/levels"
import { liveLevel, type Answers } from "@/lib/onboarding"
import type { Lift } from "@/lib/types"
import { cn } from "@/lib/utils"

// Written out in full so Tailwind sees the class names.
const LEVEL_TEXT: Record<Level, string> = {
  beginner: "text-level-beginner",
  novice: "text-level-novice",
  intermediate: "text-level-intermediate",
  advanced: "text-level-advanced",
  elite: "text-level-elite",
}
const LEVEL_BAR: Record<Level, string> = {
  beginner: "bg-level-beginner",
  novice: "bg-level-novice",
  intermediate: "bg-level-intermediate",
  advanced: "bg-level-advanced",
  elite: "bg-level-elite",
}
// How long typing has to pause before the level shows (stops it jumping while you type "140").
const SETTLE_MS = 300

/**
 * A level card's live level: its name and 5 bars filled up to it, in the level's color. While
 * you type, the bars pulse in gray; 300ms after the last change the level fades in. Nothing shows
 * until the card is filled in with an answer the checks would accept.
 */
export function LiveLevel({ answers, card }: { answers: Answers; card: Lift | "race" }) {
  const t = useTranslations("onboarding.level")
  const filled = card === "race" ? answers.race.time !== "" : answers.lifts[card].weight !== "" && answers.lifts[card].reps !== ""
  const inputs = card === "race" ? `${answers.race.distance} ${answers.race.time}` : `${answers.lifts[card].weight}×${answers.lifts[card].reps}`
  const settled = useSettled(inputs, SETTLE_MS)
  const waiting = filled && settled !== inputs
  const level = filled && !waiting ? liveLevel(answers, card) : null
  const rank = level ? LEVELS.indexOf(level) : -1

  return (
    <span className={cn("flex items-center gap-2 text-[13px] font-medium transition-opacity duration-200", !waiting && !level && "opacity-0")}>
      <span aria-live="polite" className={cn("transition-colors duration-200", level && LEVEL_TEXT[level])}>
        {level && (
          <>
            <span className="sr-only">{t("levelIs")} </span>
            {t(`levels.${level}`)}
          </>
        )}
      </span>
      <span aria-hidden className={cn("flex gap-[3px]", waiting && "animate-pulse motion-reduce:animate-none")}>
        {LEVELS.map((l, i) => (
          <span key={l} className={cn("h-1.5 w-3.5 rounded-[2px] transition-colors duration-200", level && i <= rank ? LEVEL_BAR[level] : "bg-foreground/15")} />
        ))}
      </span>
    </span>
  )
}
