import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Logo } from "@/components/brand/logo"
import { BackButton } from "@/components/flow/back-button"
import { brand } from "@/lib/brand"

// Pages anyone can open, signed in or not (e.g. /privacy): no sidebar, no sign-in check.
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("privacy")

  return (
    <div className="spotlight min-h-full px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" aria-label={t("backHome", { brand: brand.name })}>
            <Logo />
          </Link>
          <BackButton />
        </div>
        {children}
      </div>
    </div>
  )
}
