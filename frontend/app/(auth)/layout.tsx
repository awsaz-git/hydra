import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { AFTER_AUTH_URL } from "@/lib/auth-routes"

// Sign-in, sign-up and reset: one centered card on the page, no sidebar.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Already signed in: nothing to do here.
  const { userId } = await auth()
  if (userId) redirect(AFTER_AUTH_URL)

  return <main className="spotlight flex min-h-full items-center justify-center px-4 py-12">{children}</main>
}
