"use client"

// Shared list of conversations. The sidebar reads it; the chat view calls
// refresh() after sending a message so new titles/order show up immediately.
import { createContext, useCallback, useContext, useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { Conversation } from "@/lib/types"

interface ConversationsContextValue {
  conversations: Conversation[]
  today: string // date of the last fetch, for grouping into Today / Previous
  loading: boolean
  refresh: () => Promise<void>
  remove: (id: string) => Promise<void>
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null)

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [today, setToday] = useState("")
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setConversations(await api.listConversations())
      // Read the clock here (after a fetch), not during render: Next.js pre-renders
      // pages at build time, where "today" would be the build date.
      setToday(new Date().toDateString())
    } finally {
      setLoading(false)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id)
    setConversations((list) => list.filter((c) => c.id !== id))
  }, [])

  useEffect(() => {
    refresh().catch(() => {}) // errors surface when the user acts; the list just stays empty
  }, [refresh])

  return (
    <ConversationsContext.Provider value={{ conversations, today, loading, refresh, remove }}>
      {children}
    </ConversationsContext.Provider>
  )
}

export function useConversations() {
  const ctx = useContext(ConversationsContext)
  if (!ctx) throw new Error("useConversations must be used inside <ConversationsProvider>")
  return ctx
}
