// Every call to the backend goes through here. The browser calls /api/... on
// Next.js, and app/api/[...path]/route.ts forwards it to the Go backend.
import type { Conversation, SendMessageResult } from "@/lib/types"

/**
 * An error from the backend: {"error": {"code", "message", "params"}} (docs/ENGINEERING.md → error codes).
 * `code` is stable and is what the UI should check; `message` is the English fallback text.
 */
export class ApiError extends Error {
  status: number
  code: string
  params: Record<string, unknown>
  constructor(status: number, code: string, message: string, params: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.params = params
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!res.ok) {
    // Anything that isn't the error shape (e.g. a proxy's HTML page) becomes "internal".
    const body = await res.json().catch(() => null)
    const error = body?.error
    throw new ApiError(res.status, error?.code ?? "internal", error?.message ?? "Something went wrong", error?.params)
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
