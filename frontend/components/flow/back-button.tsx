"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

/**
 * "← Back". With onClick it does that (e.g. the previous step of a flow). Without, it does what
 * the browser's Back button does, or goes home if this tab has nothing to go back to (the page
 * was opened in a new tab). (document.referrer doesn't work here: in-app navigation never sets it.)
 */
export function BackButton({ onClick }: { onClick?: () => void }) {
  const router = useRouter()
  const t = useTranslations("ui")

  function goBack() {
    if (onClick) return onClick()
    if (window.history.length > 1) router.back()
    else router.push("/")
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {/* the arrow points the reading direction's "back": mirrored in right-to-left languages */}
      <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} className="rtl:-scale-x-100" />
      {t("back")}
    </button>
  )
}
