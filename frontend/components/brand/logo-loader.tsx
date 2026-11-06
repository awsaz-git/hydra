import { LogoMark } from "@/components/brand/logo"

/**
 * The loading state: the logo, centered on the whole screen, with a light sweeping through it
 * and a soft breathing glow. Used between pages (app/loading.tsx), while signing in, and while
 * onboarding finishes. `label` is what screen readers announce.
 */
export function LogoLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <LogoMark shimmer className="logo-breathe size-14" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
