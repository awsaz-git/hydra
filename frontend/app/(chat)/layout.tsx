import { auth } from "@clerk/nextjs/server"

import { AppSidebar } from "@/components/chat/app-sidebar"
import { ConversationsProvider } from "@/components/chat/conversations-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Every page in (chat) needs a signed-in user. auth.protect() sends anyone else to /sign-in.
// The data itself is protected again where it's read: app/api/[...path] and the Go backend.
export default async function ChatLayout({ children }: LayoutProps<"/">) {
  await auth.protect()

  return (
    <ConversationsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </ConversationsProvider>
  )
}
