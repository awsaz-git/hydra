"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuth, useSignUp } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { LogoLoader } from "@/components/brand/logo-loader"
import { CodeField, Field, PasswordField } from "@/components/flow/field"
import { FlowShell } from "@/components/flow/flow-shell"
import { FormError, SubmitButton, TextAction } from "@/components/flow/form-parts"
import { useFormSubmit } from "@/components/flow/use-form-submit"
import { afterAuth, useAuthErrors } from "@/lib/auth"
import { PRIVACY_URL, SIGN_IN_URL } from "@/lib/auth-routes"
import { brand } from "@/lib/brand"

/**
 * Sign-up with email + password, then a 6-digit code to verify the email.
 * Clerk keeps the attempt's state (signUp.status etc.), so this only decides which
 * screen to show. If Clerk's bot check challenges the visitor, ClerkJS shows it in a
 * dialog during signUp.password() and the call returns once it's passed.
 */
export function SignUpForm() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signUp, errors, fetchStatus } = useSignUp()
  const router = useRouter()
  const t = useTranslations("auth")
  const tBrand = useTranslations("brand")
  const authErrors = useAuthErrors()
  // Checked here, before anything goes to Clerk (Clerk only gets the password once).
  const [mismatch, setMismatch] = useState(false)

  const start = useFormSubmit(async (form) => {
    if (form.get("password") !== form.get("confirmPassword")) return setMismatch(true)

    const { error } = await signUp.password({
      emailAddress: String(form.get("email")),
      password: String(form.get("password")),
    })
    if (error) return // shown from `errors` below

    await signUp.verifications.sendEmailCode()
  })

  const verify = useFormSubmit(async (form) => {
    const { error } = await signUp.verifications.verifyEmailCode({ code: String(form.get("code")) })
    if (error) return

    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: afterAuth(router) })
    }
  })

  async function resend() {
    const { error } = await signUp.verifications.sendEmailCode()
    if (!error) toast.success(t("codeSent"))
  }

  // Signed up: finalize() is taking you into the app.
  if (isSignedIn || signUp.status === "complete") {
    return <LogoLoader label={t("signingIn")} />
  }

  // Step 2: the account exists, only the email still needs its code.
  const needsCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0

  if (needsCode) {
    return (
      <FlowShell
        title={t("signUp.checkEmail")}
        description={t("codeSentTo", { email: signUp.emailAddress ?? "" })}
        footer={<TextAction onClick={() => signUp.reset()}>{t("signUp.differentEmail")}</TextAction>}
      >
        <form method="post" onSubmit={verify.onSubmit} className="space-y-4">
          <CodeField id="code" name="code" label={t("verificationCode")} required autoFocus error={authErrors.field(errors.fields.code)} />
          <FormError>{authErrors.form(errors)}</FormError>
          <SubmitButton pending={verify.busy}>{t("signUp.verify")}</SubmitButton>
          <div className="text-center">
            <TextAction onClick={resend} disabled={verify.busy || fetchStatus === "fetching"}>
              {t("sendNewCode")}
            </TextAction>
          </div>
        </form>
      </FlowShell>
    )
  }

  // The bot check couldn't run in this browser (the sign-up stays stuck on it).
  const blockedByCheck = signUp.missingFields.includes("protect_check")

  return (
    <FlowShell
      title={t("signUp.title", { brand: brand.name })}
      description={tBrand("description")}
      footer={
        <div className="space-y-2">
          <p>
            {t.rich("signUp.haveAccount", {
              link: (text) => (
                <Link href={SIGN_IN_URL} className="text-foreground underline-offset-4 hover:underline">
                  {text}
                </Link>
              ),
            })}
          </p>
          <p>
            {t.rich("signUp.privacy", {
              link: (text) => (
                <Link href={PRIVACY_URL} className="underline-offset-4 hover:text-foreground hover:underline">
                  {text}
                </Link>
              ),
            })}
          </p>
        </div>
      }
    >
      {/* method="post": if this ever submitted without JavaScript, the password must not land in the URL */}
      <form method="post" onSubmit={start.onSubmit} className="space-y-4">
        <Field
          id="email"
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          required
          autoFocus
          error={authErrors.field(errors.fields.emailAddress)}
        />
        <PasswordField
          id="password"
          name="password"
          label={t("password")}
          autoComplete="new-password"
          required
          error={authErrors.field(errors.fields.password)}
        />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label={t("confirmPassword")}
          autoComplete="new-password"
          required
          onInput={() => setMismatch(false)}
          error={mismatch ? t("passwordsDontMatch") : null}
        />
        <FormError>{blockedByCheck ? t("securityCheckFailed") : authErrors.form(errors)}</FormError>
        <SubmitButton pending={start.busy} disabled={!isLoaded}>
          {t("signUp.submit")}
        </SubmitButton>
      </form>
    </FlowShell>
  )
}
