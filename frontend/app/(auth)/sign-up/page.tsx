import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SignUpForm } from "@/components/auth/sign-up-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata")
  return { title: t("signUp") }
}

export default function SignUpPage() {
  return <SignUpForm />
}
