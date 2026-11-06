import { auth } from "@clerk/nextjs/server"

// Onboarding: signed in, but no sidebar (the app isn't usable yet). Centered like the auth pages.
export default async function OnboardingLayout({ children }: LayoutProps<"/">) {
  await auth.protect()

  return <main className="spotlight flex min-h-full items-center justify-center px-4 py-12">{children}</main>
}
