import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"

/**
 * The form's main action: full width, white, with the screen's one glow.
 * `pending` shows the spinner. `disabled` is for "not ready yet" (e.g. Clerk still loading):
 * browsers don't submit a form, not even on Enter, while its submit button is disabled.
 */
export function SubmitButton({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className="glow hover:glow-strong h-10 w-full rounded-[10px] text-[15px] transition-shadow disabled:glow-none"
    >
      {pending && <HugeiconsIcon icon={Loading03Icon} className="animate-spin" strokeWidth={2} />}
      {children}
    </Button>
  )
}

/** An error about the whole form (not one field), e.g. "too many attempts". */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
      {children}
    </p>
  )
}

/** A small secondary action that looks like a link ("Send a new code", "Start over"). */
export function TextAction({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
    >
      {children}
    </button>
  )
}
