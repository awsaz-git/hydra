import { brand } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * The logo mark, drawn from the files in public/brand/ (a new logo = replace the files):
 *   mark.svg        regular stroke, for large marks (48px and up)
 *   mark-small.svg  bolder stroke for small marks (sidebar, avatar) so they never look thin
 *   icon.svg        the favicon / app icon (set in app/layout.tsx)
 *
 * The SVG is used as a CSS mask over a block painted in currentColor, so the mark takes
 * the text color like an icon does. The file's own colors don't matter, only its shape.
 * className (size, logo-glow) goes on the outer span: CSS applies filters before masks,
 * so a glow on the masked span itself would be cut off.
 */
export function LogoMark({ className, small = false, shimmer = false }: { className?: string; small?: boolean; shimmer?: boolean }) {
  const mask = `url(/brand/${small ? "mark-small" : "mark"}.svg) center / contain no-repeat`

  return (
    <span aria-hidden="true" className={cn("inline-block shrink-0", className)}>
      {/* shimmer: a light sweeping through the mark (the loading state) instead of a flat color */}
      <span className={cn("block size-full", shimmer ? "logo-shimmer" : "bg-current")} style={{ mask, WebkitMask: mask }} />
    </span>
  )
}

/** Mark + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="size-6 logo-glow" small />
      <span className="text-lg font-semibold tracking-[-0.045em]">{brand.wordmark}</span>
    </span>
  )
}
