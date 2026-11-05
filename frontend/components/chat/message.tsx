import { LogoMark } from "@/components/brand/logo"
import { Markdown } from "@/components/chat/markdown"
import { cn } from "@/lib/utils"
import type { Message } from "@/lib/types"

/** A message as the UI sees it: saved, or still being sent / failed. */
export type UiMessage = Message & {
  failed?: boolean // send failed; show retry
  fresh?: boolean // just arrived; play the "new message" animation
}

export function CoachAvatar({ thinking = false }: { thinking?: boolean }) {
  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[10px] border bg-card text-foreground",
        thinking && "coach-pulse"
      )}
    >
      <LogoMark className="size-4" weight={7.5} />
    </div>
  )
}

export function UserMessage({ message, onRetry }: { message: UiMessage; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[15px] leading-6",
          message.failed && "opacity-60"
        )}
      >
        {message.content}
      </div>
      {message.failed && (
        <p className="text-xs text-destructive">
          Not sent ·{" "}
          <button onClick={onRetry} className="underline underline-offset-2">
            Retry
          </button>
        </p>
      )}
    </div>
  )
}

export function CoachMessage({ message }: { message: UiMessage }) {
  return (
    <div
      className={cn(
        "flex gap-3",
        // a freshly arrived reply fades in and slides up, like a new text
        message.fresh && "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
      )}
    >
      <CoachAvatar />
      <div className="min-w-0 flex-1 pt-0.5 text-[15px] text-foreground/90">
        <Markdown>{message.content}</Markdown>
      </div>
    </div>
  )
}
