import { ChatView } from "@/components/chat/chat-view"

// "/c/<id>" is an existing chat.
export default async function ChatPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params // params is a Promise in Next.js 15+
  // key={id}: switching chats creates a fresh ChatView instead of reusing the old one's state
  return <ChatView key={id} conversationId={id} />
}
