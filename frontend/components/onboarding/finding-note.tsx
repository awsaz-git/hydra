"use client"

import { useEffect, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

import { brand } from "@/lib/brand"
import type { Finding } from "@/lib/types"
import { cmToFeetInches, formatDuration, kgToLb, round, type UnitSystem } from "@/lib/units"
import { cn } from "@/lib/utils"

const FADE_MS = 200

/**
 * The live check result under a field: one short message, or nothing. "error" blocks (red),
 * "warning" doesn't (gray). It fades in, and when it goes away it fades out before it's removed.
 */
export function FieldCheck({ finding, units }: { finding?: Finding; units: UnitSystem }) {
  // What's on screen: the current message, or the last one while it fades out.
  const [shown, setShown] = useState(finding)
  if (finding && JSON.stringify(finding) !== JSON.stringify(shown)) setShown(finding)

  useEffect(() => {
    if (finding) return
    const timer = setTimeout(() => setShown(undefined), FADE_MS)
    return () => clearTimeout(timer)
  }, [finding])

  if (!shown) return null
  return <FindingNote finding={shown} units={units} leaving={!finding} />
}

function FindingNote({ finding, units, leaving }: { finding: Finding; units: UnitSystem; leaving: boolean }) {
  const t = useTranslations("onboarding")
  const tUnits = useTranslations("units")
  const format = useFormatter()
  const p = finding.params ?? {}
  const num = (n: number) => format.number(round(n, 1))

  // Weights and heights in the user's units ("81.6 kg" or "180 lb", "177.8 cm" or "5 ft 10 in").
  const weight = (kg: number) => (units === "metric" ? tUnits("kg", { value: num(kg) }) : tUnits("lb", { value: num(kgToLb(kg)) }))
  const height = (cm: number) => {
    if (units === "metric") return tUnits("cm", { value: num(cm) })
    const { feet, inches } = cmToFeetInches(cm)
    return tUnits("ftIn", { feet, inches })
  }
  const stored = (value: number, unit: string) => (unit === "cm" ? height(value) : weight(value))

  let text: string
  switch (finding.code) {
    case "out_of_range":
      text = t("findings.out_of_range", { min: stored(Number(p.min), String(p.unit)), max: stored(Number(p.max), String(p.unit)) })
      break
    case "time_out_of_range":
      text = t("findings.time_out_of_range", { max: formatDuration(Number(p.max_seconds)) })
      break
    case "impossible_lift":
      text = t("findings.impossible_lift", { record: weight(Number(p.record_kg)) })
      break
    case "unusual_lift":
      text = t("findings.unusual_lift", { ratio: num(Number(p.ratio)) })
      break
    case "impossible_time":
      text = t("findings.impossible_time", { record: formatDuration(Number(p.record_seconds)) })
      break
    case "under_16":
      text = t("findings.under_16", { min_age: Number(p.min_age), brand: brand.name })
      break
    case "groups_count":
      text = t("findings.groups_count", { min: Number(p.min) })
      break
    case "reps_out_of_range":
      text = t("findings.reps_out_of_range", { min: Number(p.min), max: Number(p.max) })
      break
    default:
      text = t.has(`findings.${finding.code}` as never) ? t(`findings.${finding.code}` as never) : t("findings.invalid_choice")
  }

  const error = finding.severity === "error"
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-1.5 text-[13px] duration-200 motion-reduce:animate-none",
        leaving ? "animate-out fade-out fill-mode-forwards" : "animate-in fade-in",
        error ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={1.75} className="mt-[3px] shrink-0" />
      <span>{text}</span>
    </p>
  )
}
