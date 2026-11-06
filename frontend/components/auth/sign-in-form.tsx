"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useAuth, useSignIn } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { LogoLoader } from "@/components/brand/logo-loader"
import { CodeField, Field, PasswordField } from "@/components/flow/field"
import { FlowShell } from "@/components/flow/flow-shell"
import { FormError, SubmitButton, TextAction } from "@/components/flow/form-parts"
import { useFormSubmit } from "@/components/flow/use-form-submit"
import { afterAuth, useAuthErrors } from "@/lib/auth"
import { RESET_PASSWORD_URL, SIGN_UP_URL } from "@/lib/auth-routes"
import { brand } from "@/lib/brand"

const linkClass = "text-foreground underline-offset-4 hover:underline"

/**
 * Sign-in with email + password. On a device Clerk doesn't know yet (Device Trust),
 * it also asks for a 6-digit code sent to the account's email.
 */
export function SignInForm() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()
  const t = useTranslations("auth")
  const authErrors = useAuthErrors()
  // A status we don't support (e.g. MFA, which is off in Clerk) gets a message, not a dead end.
  const [unsupported, setUnsupported] = useState(false)

  const start = useFormSubmit(async (form) => {
    setUnsupported(false)

    const { error } = await signIn.password({
      emailAddress: String(form.get("email")),
      password: String(form.get("password")),
    })
    if (error) return // shown from `errors` below

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: afterAuth(router) })
    } else if (
      signIn.status === "needs_client_trust" &&
      signIn.supportedSecondFactors.some((factor) => factor.strategy === "email_code")
    ) {
      await signIn.mfa.sendEmailCode()
    } else {
      console.error("sign-in not complete:", signIn.status)
      setUnsupported(true)
    }
  })

  const verify = useFormSubmit(async (form) => {
    const { error } = await signIn.mfa.verifyEmailCode({ code: String(form.get("code")) })
    if (error) return

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: afterAuth(router) })
    }
  })

  async function resend() {
    const { error } = await signIn.mfa.sendEmailCode()
    if (!error) toast.success(t("codeSent"))
  }

  // Signed in: finalize() is taking you into the app.
  if (isSignedIn || signIn.status === "complete") {
    return <LogoLoader label={t("signingIn")} />
  }

  // New device: the password was right, now the emailed code.
  if (signIn.status === "needs_client_trust") {
    return (
      <FlowShell
        title={t("signIn.trustTitle")}
        description={t("signIn.trustDescription")}
        footer={<TextAction onClick={() => signIn.reset()}>{t("signIn.startOver")}</TextAction>}
      >
        <form method="post" onSubmit={verify.onSubmit} className="space-y-4">
          <CodeField id="code" name="code" label={t("verificationCode")} required autoFocus error={authErrors.field(errors.fields.code)} />
          <FormError>{authErrors.form(errors)}</FormError>
          <SubmitButton pending={verify.busy}>{t("continue")}</SubmitButton>
          <div className="text-center">
            <TextAction onClick={resend} disabled={verify.busy || fetchStatus === "fetching"}>
              {t("sendNewCode")}
            </TextAction>
          </div>
        </form>
      </FlowShell>
    )
  }

  // The password is right but was found in a data breach: Clerk won't accept it any more.
  const pwned = errors.fields.password?.code === "form_password_pwned"

  return (
    <FlowShell
      title={t("signIn.title", { brand: brand.name })}
      footer={t.rich("signIn.newHere", {
        link: (text) => (
          <Link href={SIGN_UP_URL} className={linkClass}>
            {text}
          </Link>
        ),
      })}
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
          error={authErrors.field(errors.fields.identifier)}
        />
        <PasswordField
          id="password"
          name="password"
          label={t("password")}
          autoComplete="current-password"
          required
          labelAction={
            <Link href={RESET_PASSWORD_URL} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("signIn.forgotPassword")}
            </Link>
          }
          error={pwned ? null : authErrors.field(errors.fields.password)}
        />
        <FormError>
          {pwned
            ? t.rich("signIn.pwned", {
                link: (text) => (
                  <Link href={RESET_PASSWORD_URL} className="underline underline-offset-4">
                    {text}
                  </Link>
                ),
              })
            : unsupported
              ? t("unsupportedStep")
              : authErrors.form(errors)}
        </FormError>
        <SubmitButton pending={start.busy} disabled={!isLoaded}>
          {t("signIn.submit")}
        </SubmitButton>
      </form>
    </FlowShell>
  )
}
