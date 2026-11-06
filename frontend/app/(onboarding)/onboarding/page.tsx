import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { AFTER_AUTH_URL } from "@/lib/auth-routes"
import { getMe } from "@/lib/server-api"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: t("onboarding") }
}

export default async function OnboardingPage() {
  const me = await getMe()
  if (me?.onboarded && me.consent_current) redirect(AFTER_AUTH_URL) // nothing left to do

  // Onboarded before a policy change: only the new consent is needed.
  return <OnboardingFlow consentOnly={me?.onboarded ?? false} />
}
