import { getTranslations } from "next-intl/server"

import { LogoLoader } from "@/components/brand/logo-loader"

// Shown while any page below the root loads, including the route groups' layouts (the sign-in
// and onboarding checks run there). A loading.tsx doesn't cover the layout in its own folder,
// so it lives here, above them all.
export default async function Loading() {
  const t = await getTranslations("ui")
  return <LogoLoader label={t("loading")} />
}
