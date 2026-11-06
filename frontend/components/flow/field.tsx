"use client"

import { useState, type ComponentProps, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string
  label: string
  /** Shown under the input in red; also marks the input invalid for screen readers. */
  error?: string | null
  /** Something on the label's line, right-aligned (e.g. a "Forgot password?" link). */
  labelAction?: ReactNode
  /** A small button inside the input, at its end (e.g. show/hide password). */
  trailing?: ReactNode
}

/**
 * A labelled input with its error message underneath. The browser's own checks
 * (required, type="email", pattern) show their message here too, instead of the
 * browser's small bubble, which is easy to miss. `error` (from the server) wins.
 */
export function Field({ id, label, error, labelAction, trailing, className, ...props }: FieldProps) {
  const [browserError, setBrowserError] = useState<string | null>(null)
  const shown = error ?? browserError

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-error` : undefined}
          className={cn("h-10 rounded-[10px] px-3 text-[15px]", trailing && "pr-10", className)}
          {...props}
          onInvalid={(e) => {
            e.preventDefault() // no bubble: the message is shown below
            setBrowserError(e.currentTarget.validationMessage)
          }}
          onInput={() => setBrowserError(null)}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {shown && (
        <p id={`${id}-error`} className="text-[13px] text-destructive">
          {shown}
        </p>
      )}
    </div>
  )
}

/** A password Field with a show/hide button, so long passwords can be checked before sending. */
export function PasswordField(props: Omit<FieldProps, "type">) {
  const [visible, setVisible] = useState(false)

  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="flex size-8 items-center justify-center rounded-md text-hint transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={18} strokeWidth={1.5} />
        </button>
      }
    />
  )
}

/** A 6-digit one-time code (email verification). Phones show the number pad and can autofill it. */
export function CodeField(props: Omit<FieldProps, "type" | "inputMode" | "autoComplete">) {
  return (
    <Field
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      className="text-center font-mono text-lg tracking-[0.5em]"
    />
  )
}
