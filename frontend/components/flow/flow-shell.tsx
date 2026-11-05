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
  children,
}: {
  title: string
  description?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="w-full max-w-sm">
      {/* No glow on the logo here: the submit button is this screen's one glowing element */}
      <div className="mb-8 flex justify-center">
        <LogoMark className="size-12" />
      </div>
      <div className="shine rounded-xl border bg-card p-6">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
          {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</div>}
    </div>
  )
}
