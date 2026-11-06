"use client"

import { cn } from "@/lib/utils"

/**
 * A square switch between a few options (e.g. Metric | Imperial): the selected one is white
 * with the brand's thin edge light. Keyboard: Tab to it, Space/Enter on an option.
 */
export function SegmentedSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="shine grid gap-1 rounded-[10px] border bg-card p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-[7px] text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200",
              selected ? "edge-glow bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
