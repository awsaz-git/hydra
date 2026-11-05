import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppSidebar } from "@/components/chat/app-sidebar"
import { ConversationsProvider } from "@/components/chat/conversations-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
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
        <TooltipProvider>
          <ConversationsProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
          </ConversationsProvider>
        </TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
