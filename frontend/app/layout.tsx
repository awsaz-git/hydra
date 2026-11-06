import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { directionOf } from "@/i18n/config"
import { AFTER_AUTH_URL, SIGN_IN_URL, SIGN_UP_URL } from "@/lib/auth-routes"
import { brand } from "@/lib/brand"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("brand")
  return {
    // Pages that set their own title get "<title> · <name>"
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: t("description"),
    icons: { icon: "/brand/icon.svg" }, // the logo files live in public/brand/
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale() // from i18n/request.ts

  return (
    // "dark" is always on: the brand is dark-only for v1 (docs/BRAND.md).
    // dir: right-to-left languages flip the layout (we use start/end classes, not left/right).
    <html lang={locale} dir={directionOf(locale)} className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        {/* Clerk's session state for the hooks (useSignIn, useAuth, ...). Goes inside <body>. */}
        <ClerkProvider
          signInUrl={SIGN_IN_URL}
          signUpUrl={SIGN_UP_URL}
          signInFallbackRedirectUrl={AFTER_AUTH_URL}
          signUpFallbackRedirectUrl={AFTER_AUTH_URL}
        >
          {/* The chat (sidebar) and the auth pages each have their own layout: app/(chat), app/(auth) */}
          {/* Gives client components the messages (useTranslations); loaded on the server */}
          <NextIntlClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="top-center" duration={3000} />
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
