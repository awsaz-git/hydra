import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * One input box holding several values: "[weight] × [reps]", "[5] ft [10] in",
 * "[distance] in [time]". Looks and focuses like a single Input.
 */
export function InputGroup({ label, labelFor, children }: { label?: string; labelFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={labelFor} className="block text-[13px] font-medium">
          {label}
        </label>
      )}
      <div className="flex h-10 items-center gap-2 rounded-[10px] border border-input px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {children}
      </div>
    </div>
  )
}

/** A value inside an InputGroup, with an optional unit after it. */
export function GroupInput({ unit, className, ...props }: ComponentProps<"input"> & { unit?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <input {...props} className={cn("min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-hint", className)} />
      {unit && <span className="shrink-0 text-[13px] text-hint">{unit}</span>}
    </span>
  )
}

/** The faint word or sign between two values ("×", "in"). */
export function GroupSeparator({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-[13px] text-foreground/30">{children}</span>
}
