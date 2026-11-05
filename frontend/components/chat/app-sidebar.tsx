"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons"

import { Logo } from "@/components/brand/logo"
import { useConversations } from "@/components/chat/conversations-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Conversation } from "@/lib/types"

/** Splits conversations into "Today" and "Previous" by last activity. */
function groupByDay(list: Conversation[], today: string) {
  return {
    today: list.filter((c) => new Date(c.updated_at).toDateString() === today),
    previous: list.filter((c) => new Date(c.updated_at).toDateString() !== today),
  }
}

export function AppSidebar() {
  const { conversations, today: todayDate, loading, remove } = useConversations()
  const pathname = usePathname()
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const closeOnMobile = () => setOpenMobile(false) // the sidebar is a slide-over sheet on phones
  // Kept separate from `open` so the dialog text doesn't change while it fades out.
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { today, previous } = groupByDay(conversations, todayDate)

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setDialogOpen(false)
    try {
      await remove(id)
      if (pathname === `/c/${id}`) router.push("/")
    } catch {
      toast.error("Couldn't delete that chat. Try again.")
    }
  }

  const renderGroup = (label: string, items: Conversation[]) =>
    items.length > 0 && (
      <SidebarGroup>
        <SidebarGroupLabel className="text-hint uppercase tracking-[0.08em] text-[11px]">{label}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((c) => (
            <SidebarMenuItem key={c.id}>
              <SidebarMenuButton asChild isActive={pathname === `/c/${c.id}`} className="text-muted-foreground data-[active=true]:shine">
                <Link href={`/c/${c.id}`} onClick={closeOnMobile}>
                  <span className="truncate">{c.title || "New chat"}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction showOnHover onClick={() => {
                  setPendingDelete(c)
                  setDialogOpen(true)
                }} aria-label="Delete chat">
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} />
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )

  return (
    <>
      <Sidebar>
        <SidebarHeader className="gap-4 p-4">
          <Link href="/" aria-label="Hydra home">
            <Logo />
          </Link>
          <Button asChild className="edge-glow hover:edge-glow-hover h-9 w-full rounded-[10px] transition-shadow duration-500 ease-out hover:bg-primary">
            <Link href="/" onClick={closeOnMobile}>
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.5} />
              New chat
            </Link>
          </Button>
        </SidebarHeader>

        <SidebarContent>
          {loading ? (
            <SidebarMenu className="px-2">
              {Array.from({ length: 4 }, (_, i) => (
                <SidebarMenuSkeleton key={i} />
              ))}
            </SidebarMenu>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-2 text-sm text-hint">No chats yet.</p>
          ) : (
            <>
              {renderGroup("Today", today)}
              {renderGroup("Previous", previous)}
            </>
          )}
        </SidebarContent>
      </Sidebar>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title || "New chat"}&rdquo; and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
