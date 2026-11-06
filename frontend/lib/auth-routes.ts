// Where the auth pages live. proxy.ts and <ClerkProvider> both read these,
// so Clerk's own redirects always land on our custom pages.
export const SIGN_IN_URL = "/sign-in"
export const SIGN_UP_URL = "/sign-up"
// Where you land after signing in or up (onboarding takes over later).
export const AFTER_AUTH_URL = "/"
// Forgot password, and where a user goes whose password must be replaced (a session task).
export const RESET_PASSWORD_URL = "/reset-password"
