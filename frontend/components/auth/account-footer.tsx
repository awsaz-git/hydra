"use client"

import { useClerk, useUser } from "@clerk/nextjs"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon } from "@hugeicons/core-free-icons"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SIGN_IN_URL } from "@/lib/auth-routes"

/** Bottom of the sidebar: who's signed in, and sign out. */
export function AccountFooter() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const t = useTranslations("account")

  return (
    <div className="flex items-center gap-2 px-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {user?.primaryEmailAddress?.emailAddress}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("signOut")}
            onClick={() => signOut({ redirectUrl: SIGN_IN_URL })}
            className="text-muted-foreground hover:text-foreground"
          >
            {/* An arrow pointing out of the door: it points the other way in right-to-left languages */}
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={1.5} className="rtl:-scale-x-100" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("signOut")}</TooltipContent>
      </Tooltip>
    </div>
  )
}
