"use client"

import type { ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"

/** Styles shared by every card that can be picked (OptionCard, and the level cards). */
export const pickableCard = (selected: boolean) =>
  cn(
    "rounded-xl border transition-[background-color,border-color,box-shadow,color] duration-200",
    selected ? "shine edge-glow border-foreground/30 bg-accent text-foreground" : "bg-card text-muted-foreground hover:text-foreground",
  )

/** A card with an icon and a label that can be picked (sex, athlete groups). */
export function OptionCard({
  icon,
  label,
  selected,
  onClick,
  role = "checkbox",
  compact = false,
}: {
  icon: IconSvgElement
  label: ReactNode
  selected: boolean
  onClick: () => void
  /** "radio" when only one of a group can be picked. */
  role?: "checkbox" | "radio"
  /** Icon beside the label, as tall as an input (sex), instead of above it. */
  compact?: boolean
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        pickableCard(selected),
        "flex items-center justify-center",
        compact ? "h-10 gap-2 px-3 text-[14px]" : "flex-col gap-2 px-2 py-4 text-[13px]",
      )}
    >
      <HugeiconsIcon icon={icon} size={compact ? 18 : 22} strokeWidth={1.5} />
      <span className="text-center leading-tight">{label}</span>
    </button>
  )
}
