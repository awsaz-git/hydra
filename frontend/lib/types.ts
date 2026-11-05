// Shapes of the JSON the Go backend returns (see backend/models/models.go).

export type Role = "user" | "assistant"

export interface Message {
  id: number
  role: Role
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages?: Message[] // only included when fetching one conversation
}

export interface SendMessageResult {
  user_message: Message
  assistant_message: Message
}
