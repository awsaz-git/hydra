import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/chat/app-sidebar"
import { ConversationsProvider } from "@/components/chat/conversations-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ONBOARDING_URL } from "@/lib/auth-routes"
import { getMe } from "@/lib/server-api"

// Every page in (chat) needs a signed-in user. auth.protect() sends anyone else to /sign-in.
// The data itself is protected again where it's read: app/api/[...path] and the Go backend.
// Then: no chat before onboarding and consent to the current privacy policy. (If the backend
// can't be reached, getMe is null and the chat shows that error instead of redirecting.)
export default async function ChatLayout({ children }: LayoutProps<"/">) {
  await auth.protect()
  const me = await getMe()
  if (me && (!me.onboarded || !me.consent_current)) redirect(ONBOARDING_URL)

  return (
    <ConversationsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </ConversationsProvider>
  )
}
