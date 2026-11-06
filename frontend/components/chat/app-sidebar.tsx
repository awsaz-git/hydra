"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons"

import { AccountFooter } from "@/components/auth/account-footer"
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
  SidebarFooter,
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
import { brand } from "@/lib/brand"

/** Splits conversations into "Today" and "Previous" by last activity. */
function groupByDay(list: Conversation[], today: string) {
  return {
    today: list.filter((c) => new Date(c.updated_at).toDateString() === today),
    previous: list.filter((c) => new Date(c.updated_at).toDateString() !== today),
  }
}

export function AppSidebar() {
  const t = useTranslations("chat")
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
      toast.error(t("deleteFailed"))
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
                  <span className="truncate">{c.title || t("newChat")}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction showOnHover onClick={() => {
                  setPendingDelete(c)
                  setDialogOpen(true)
                }} aria-label={t("deleteChat")}>
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
          <Link href="/" aria-label={t("home", { brand: brand.name })}>
            <Logo />
          </Link>
          <Button asChild className="edge-glow hover:edge-glow-hover h-9 w-full rounded-[10px] transition-shadow duration-500 ease-out hover:bg-primary">
            <Link href="/" onClick={closeOnMobile}>
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={1.5} />
              {t("newChat")}
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
            <p className="px-4 py-2 text-sm text-hint">{t("noChats")}</p>
          ) : (
            <>
              {renderGroup(t("today"), today)}
              {renderGroup(t("previous"), previous)}
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t p-3">
          <AccountFooter />
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { title: pendingDelete?.title || t("newChat") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
