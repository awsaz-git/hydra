"use client"

import { useClerk, useUser } from "@clerk/nextjs"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SIGN_IN_URL } from "@/lib/auth-routes"

/** Bottom of the sidebar: who's signed in, and sign out. */
export function AccountFooter() {
  const { user } = useUser()
  const { signOut } = useClerk()

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
            aria-label="Sign out"
            onClick={() => signOut({ redirectUrl: SIGN_IN_URL })}
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={1.5} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sign out</TooltipContent>
      </Tooltip>
    </div>
  )
}
