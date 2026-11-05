import { cn } from "@/lib/utils"

/**
 * The "hy" ligature mark (docs/brand/logo.svg): the h's right leg flows into the y.
 * Drawn as one stroke weight with round ends, in currentColor.
 *
 * `weight` is the stroke width: use the regular 5.5 for large marks and a bolder
 * 7–7.5 for small ones (sidebar, avatar, favicon) so they never look thin.
 */
export function LogoMark({ className, weight = 5.5 }: { className?: string; weight?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 7 V43" />
      <path d="M15 26 C15 18.5 31 18.5 31 26 V32 C31 39.5 35 42.5 40.5 42.5 C46 42.5 49.5 39.5 49.5 32" />
      <path d="M49.5 23 V46.5 C49.5 54.5 44.5 57.5 37.5 57.5" />
    </svg>
  )
}

/** Mark + "hydra" wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-6 logo-glow" weight={7} />
      <span className="text-lg font-semibold tracking-[-0.045em]">hydra</span>
    </span>
  )
}
