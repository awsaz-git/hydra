import type { ReactNode } from "react"

import { LogoMark } from "@/components/brand/logo"

/**
 * The frame for one-card flows: sign-in, sign-up, password reset, and later onboarding.
 * Logo on top, a card with the title and the form, and an optional footer line under it.
 * The page around it (centering, spotlight) comes from the route group's layout.
 */
export function FlowShell({
  title,
  description,
  footer,
  wide = false,
  eyebrow,
  children,
}: {
  title: string
  description?: ReactNode
  footer?: ReactNode
  /** A wider card, for screens with many fields (onboarding's level page). */
  wide?: boolean
  /** A small line above the title ("Step 2 of 4"). */
  eyebrow?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={wide ? "w-full max-w-lg" : "w-full max-w-sm"}>
      {/* No glow on the logo here: the submit button is this screen's one glowing element */}
      <div className="mb-8 flex justify-center">
        <LogoMark className="size-12" />
      </div>
      <div className="shine rounded-xl border bg-card p-6">
        <div className="mb-6 space-y-1.5">
          {eyebrow && <p className="text-[12px] text-hint">{eyebrow}</p>}
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
          {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</div>}
    </div>
  )
}
