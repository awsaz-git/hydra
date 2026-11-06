"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuth, useSignIn } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { CodeField, Field, PasswordField } from "@/components/flow/field"
import { FlowShell } from "@/components/flow/flow-shell"
import { FormError, SubmitButton, TextAction } from "@/components/flow/form-parts"
import { useFormSubmit } from "@/components/flow/use-form-submit"
import { afterAuth, useAuthErrors } from "@/lib/auth"
import { SIGN_IN_URL } from "@/lib/auth-routes"

/**
 * Forgot password: email → 6-digit code → new password, then you're signed in.
 * Setting the new password signs out every other session, so anyone still holding an
 * old one (e.g. on a lost phone) is out.
 */
export function ResetPasswordForm() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()
  const t = useTranslations("auth")
  const authErrors = useAuthErrors()
  // The email the code went to; null until it's sent (Clerk has no status for "code sent").
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  const sendCode = useFormSubmit(async (form) => {
    const email = String(form.get("email"))

    const { error } = await signIn.create({ identifier: email })
    if (error) return // shown from `errors` below
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode()
    if (sendError) return

    setSentTo(email)
  })

  const verifyCode = useFormSubmit(async (form) => {
    // On success Clerk moves to "needs_new_password", which shows the next screen.
    await signIn.resetPasswordEmailCode.verifyCode({ code: String(form.get("code")) })
  })

  const setPassword = useFormSubmit(async (form) => {
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: String(form.get("password")),
      signOutOfOtherSessions: true,
    })
    if (error) return

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: afterAuth(router) })
    } else {
      console.error("reset not complete:", signIn.status)
      setUnsupported(true)
    }
  })

  async function resend() {
    const { error } = await signIn.resetPasswordEmailCode.sendCode()
    if (!error) toast.success(t("codeSent"))
  }

  const backToSignIn = (
    <Link href={SIGN_IN_URL} className="text-foreground underline-offset-4 hover:underline">
      {t("reset.backToSignIn")}
    </Link>
  )

  if (isSignedIn || signIn.status === "complete") {
    return <FlowShell title={t("signingIn")}>{null}</FlowShell>
  }

  // Step 3: the code was right.
  if (signIn.status === "needs_new_password") {
    return (
      <FlowShell title={t("reset.newTitle")} description={t("reset.newDescription")} footer={backToSignIn}>
        <form method="post" onSubmit={setPassword.onSubmit} className="space-y-4">
          <PasswordField
            id="password"
            name="password"
            label={t("newPassword")}
            autoComplete="new-password"
            required
            autoFocus
            error={authErrors.field(errors.fields.password)}
          />
          <FormError>{unsupported ? t("unsupportedStep") : authErrors.form(errors)}</FormError>
          <SubmitButton pending={setPassword.busy}>{t("reset.setSubmit")}</SubmitButton>
        </form>
      </FlowShell>
    )
  }

  // Step 2: the code is on its way.
  if (sentTo) {
    return (
      <FlowShell
        title={t("signUp.checkEmail")}
        description={t("codeSentTo", { email: sentTo })}
        footer={<TextAction onClick={() => setSentTo(null)}>{t("signUp.differentEmail")}</TextAction>}
      >
        <form method="post" onSubmit={verifyCode.onSubmit} className="space-y-4">
          <CodeField id="code" name="code" label={t("resetCode")} required autoFocus error={authErrors.field(errors.fields.code)} />
          <FormError>{authErrors.form(errors)}</FormError>
          <SubmitButton pending={verifyCode.busy}>{t("continue")}</SubmitButton>
          <div className="text-center">
            <TextAction onClick={resend} disabled={verifyCode.busy || fetchStatus === "fetching"}>
              {t("sendNewCode")}
            </TextAction>
          </div>
        </form>
      </FlowShell>
    )
  }

  // Step 1: which account.
  return (
    <FlowShell title={t("reset.title")} description={t("reset.description")} footer={backToSignIn}>
      {/* method="post": if this ever submitted without JavaScript, nothing lands in the URL */}
      <form method="post" onSubmit={sendCode.onSubmit} className="space-y-4">
        <Field
          id="email"
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          required
          autoFocus
          error={authErrors.field(errors.fields.identifier)}
        />
        <FormError>{authErrors.form(errors)}</FormError>
        <SubmitButton pending={sendCode.busy} disabled={!isLoaded}>
          {t("reset.submit")}
        </SubmitButton>
      </form>
    </FlowShell>
  )
}
