import { readFile } from "node:fs/promises"
import path from "node:path"

import type { Metadata } from "next"
import { getFormatter, getLocale, getTranslations } from "next-intl/server"

import { Markdown } from "@/components/chat/markdown"
import { defaultLocale, isLocale } from "@/i18n/config"
import { brand } from "@/lib/brand"
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: t("privacy") }
}

/**
 * The privacy policy, from content/privacy/<locale>.md. The text names the product, the
 * operator and the contact as {brand}, {operator} and {email}; they come from lib/brand.ts,
 * so a rename or a new contact address never means editing the policy files.
 */
export default async function PrivacyPage() {
  const locale = await getLocale()
  const t = await getTranslations("privacy")
  const format = await getFormatter()

  // isLocale: only a known language can become part of the file path.
  const file = path.join(process.cwd(), "content", "privacy", `${isLocale(locale) ? locale : defaultLocale}.md`)
  const text = (await readFile(file, "utf8"))
    .replaceAll("{brand}", brand.name)
    .replaceAll("{operator}", brand.legalName)
    .replaceAll("{email}", brand.supportEmail)

  return (
    <article className="text-[15px] text-foreground/90">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-foreground">{t("title")}</h1>
      <p className="mt-2 mb-8 text-[13px] text-muted-foreground">
        {t("lastUpdated", { date: format.dateTime(new Date(PRIVACY_POLICY_VERSION), { dateStyle: "long", timeZone: "UTC" }) })}
      </p>
      <Markdown>{text}</Markdown>
    </article>
  )
}
