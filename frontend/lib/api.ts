// Every call to the backend goes through here. The browser calls /api/... on
// Next.js, and app/api/[...path]/route.ts forwards it to the Go backend.
import type { Conversation, SendMessageResult } from "@/lib/types"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    // The backend sends errors as {"error": "..."}
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? "Something went wrong")
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  listConversations: () => request<Conversation[]>("/conversations"),

  createConversation: () => request<Conversation>("/conversations", { method: "POST" }),

  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),

  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),

  sendMessage: (id: string, content: string) =>
    request<SendMessageResult>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
}
