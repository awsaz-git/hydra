import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AFTER_AUTH_URL, SIGN_IN_URL, SIGN_UP_URL } from "@/lib/auth-routes"
import { brand } from "@/lib/brand"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  // Pages that set their own title get "<title> · <name>"
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  icons: { icon: "/brand/icon.svg" }, // the logo files live in public/brand/
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // "dark" is always on: the brand is dark-only for v1 (docs/BRAND.md)
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        {/* Clerk's session state for the hooks (useSignIn, useAuth, ...). Goes inside <body>. */}
        <ClerkProvider
          signInUrl={SIGN_IN_URL}
          signUpUrl={SIGN_UP_URL}
          signInFallbackRedirectUrl={AFTER_AUTH_URL}
          signUpFallbackRedirectUrl={AFTER_AUTH_URL}
        >
          {/* The chat (sidebar) and the auth pages each have their own layout: app/(chat), app/(auth) */}
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  )
}
