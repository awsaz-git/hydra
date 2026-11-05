"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { CoachThinking } from "@/components/chat/coach-thinking"
import { Composer } from "@/components/chat/composer"
import { useConversations } from "@/components/chat/conversations-provider"
import { EmptyState } from "@/components/chat/empty-state"
import { CoachMessage, UserMessage, type UiMessage } from "@/components/chat/message"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ApiError, api } from "@/lib/api"

/**
 * One chat. With no conversationId it's a brand-new chat: the conversation is
 * created on the first message.
 */
export function ChatView({ conversationId }: { conversationId?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { conversations, refresh } = useConversations()

  const [id, setId] = useState<string | null>(conversationId ?? null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [loading, setLoading] = useState(Boolean(conversationId))
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nextTempId = useRef(-1) // temporary ids (negative) for messages not saved yet

  const title = conversations.find((c) => c.id === id)?.title || "New chat"

  // Load an existing chat's history.
  useEffect(() => {
    if (!conversationId) return
    api
      .getConversation(conversationId)
      .then((c) => setMessages(c.messages ?? []))
      .catch((e) => {
        toast.error(e instanceof ApiError && e.status === 404 ? "That chat doesn't exist anymore." : e.message)
        router.replace("/")
      })
      .finally(() => setLoading(false))
  }, [conversationId, router])

  // "New chat" navigates to "/" while this view may still hold a chat: reset it.
  // (Adjusting state during render when a value changes is React's recommended
  // pattern; doing it in a useEffect would render twice.)
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (!conversationId && pathname === "/") {
      setId(null)
      setMessages([])
    }
  }

  // Keep the newest message in view. Wait one frame so the layout (new message,
  // composer shrinking back to one line) is final; jump instantly when you send,
  // glide smoothly when the coach's reply arrives.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = scrollRef.current
      el?.scrollTo({ top: el.scrollHeight, behavior: thinking ? "instant" : "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [messages, thinking])

  async function send(text: string) {
    if (thinking) return
    // Show the user's message right away (temporary negative id until it's saved).
    const pending: UiMessage = { id: nextTempId.current--, role: "user", content: text, created_at: "" }
    const tempId = pending.id
    setMessages((m) => [...m, pending]) // updater functions must be pure: build the message outside
    setThinking(true)

    try {
      let chatId = id
      if (!chatId) {
        chatId = (await api.createConversation()).id
        setId(chatId)
        // Update the URL without remounting this view (Next.js supports native history calls).
        window.history.replaceState(null, "", `/c/${chatId}`)
      }

      const { user_message, assistant_message } = await api.sendMessage(chatId, text)
      setMessages((m) => [...m.filter((msg) => msg.id !== tempId), user_message, { ...assistant_message, fresh: true }])
      refresh() // new title / order in the sidebar
    } catch (e) {
      setMessages((m) => m.map((msg) => (msg.id === tempId ? { ...msg, failed: true } : msg)))
      toast.error(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setThinking(false)
    }
  }

  function retry(failed: UiMessage) {
    setMessages((m) => m.filter((msg) => msg.id !== failed.id))
    send(failed.content)
  }

  const isEmpty = !loading && messages.length === 0

  return (
    <div className="spotlight flex h-svh flex-col">
      <header className="flex h-13 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger className="text-muted-foreground" />
        <h2 className="truncate text-sm text-muted-foreground">{title}</h2>
      </header>

      {isEmpty ? (
        <EmptyState onPick={send} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
            {messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} message={m} onRetry={() => retry(m)} />
              ) : (
                <CoachMessage key={m.id} message={m} />
              )
            )}
            {thinking && <CoachThinking />}
          </div>
        </div>
      )}

      <Composer onSend={send} disabled={thinking || loading} />
    </div>
  )
}
