"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUp02Icon } from "@hugeicons/core-free-icons"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { brand } from "@/lib/brand"

const MAX_CHARS = 4000 // same limit the backend enforces

/** Message box. Enter sends, Shift+Enter adds a new line. */
export function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const t = useTranslations("chat")
  const [text, setText] = useState("")
  const canSend = !disabled && text.trim().length > 0

  function submit() {
    if (!canSend) return
    onSend(text.trim())
    setText("")
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="shine flex items-end gap-2 rounded-[18px] border bg-card p-2 ps-4"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={t("composerPlaceholder", { coach: brand.coachName })}
          maxLength={MAX_CHARS}
          rows={1}
          aria-label={t("composerLabel")}
          className="max-h-48 min-h-9 resize-none border-0 bg-transparent px-0 py-2 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={!canSend}
          aria-label={t("send")}
          className="glow hover:glow-strong shrink-0 rounded-[10px] transition-shadow disabled:glow-none"
        >
          <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
        </Button>
      </form>
      <p className="mt-2 text-center text-[11px] text-hint">{t("disclaimer")}</p>
    </div>
  )
}
