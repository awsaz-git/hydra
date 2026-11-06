"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { BackButton } from "@/components/flow/back-button"
import { LogoLoader } from "@/components/brand/logo-loader"
import { FlowShell } from "@/components/flow/flow-shell"
import { SubmitButton, TextAction } from "@/components/flow/form-parts"
import { useFormSubmit } from "@/components/flow/use-form-submit"
import { FieldCheck } from "@/components/onboarding/finding-note"
import { BodyStep, ConsentLine, GroupsStep, LevelStep, StartStep } from "@/components/onboarding/onboarding-steps"
import { ApiError, api } from "@/lib/api"
import { AFTER_AUTH_URL, SIGN_IN_URL } from "@/lib/auth-routes"
import { brand } from "@/lib/brand"
import { useErrorMessage } from "@/lib/errors"
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy"
import { changedFields, convertUnits, emptyAnswers, isComplete, isUnder16, STEPS, toInput, type Answers } from "@/lib/onboarding"
import type { Finding } from "@/lib/types"

// Which answers each page owns (the backend's finding.field names).
const PAGE_FIELDS: Record<number, string[]> = {
  1: ["birth_date"],
  2: ["units", "sex", "height", "weight"],
  3: ["athlete_groups", "main_group"],
  4: ["squat", "bench", "deadlift", "endurance"],
}
// How long typing has to pause before the answers are checked (owner, 2026-11-07).
const LIVE_CHECK_MS = 800

const SEX_REQUIRED: Finding = { field: "sex", severity: "error", code: "required" }

/** The last finished check: the answers it was for (as sent), and what it found on this page. */
type Checked = { key: string | null; findings: Finding[]; failed: boolean }

/**
 * Onboarding: 1 birth date + consent, 2 about you (units, sex, height, weight), 3 athlete groups,
 * 4 level (big three + endurance). The answers only live in this component until the last page
 * sends them all at once. While you type, the page's answers are checked by the backend (stored
 * nowhere), 800ms after the last change; each field shows one message under it once it's filled
 * in. "Continue" checks once more: errors block, warnings don't. With consentOnly, an onboarded
 * user just agrees to a new policy version.
 */
export function OnboardingFlow({ consentOnly }: { consentOnly: boolean }) {
  const t = useTranslations("onboarding")
  const router = useRouter()
  const { signOut } = useClerk()
  const errorMessage = useErrorMessage()

  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<Answers>(emptyAnswers)
  const [tooYoung, setTooYoung] = useState(false)
  const [finishing, setFinishing] = useState(false) // saved: the loader shows until the app opens
  // The answers when this page opened (a field shows its check once you've changed it), the last
  // check, and whether Continue was pressed (then every field shows its check).
  const [pageStart, setPageStart] = useState<Answers>(emptyAnswers)
  const [checked, setChecked] = useState<Checked>({ key: null, findings: [], failed: false })
  const [showAll, setShowAll] = useState(false)
  const latestCheck = useRef(0) // only the newest request's answer is used
  const inFlight = useRef<string | null>(null) // the answers being checked right now

  const input = toInput(answers, step)
  const inputKey = JSON.stringify(input)
  const pageFindings = (found: Finding[]) => found.filter((f) => PAGE_FIELDS[step].includes(f.field))

  async function check(key: string): Promise<Checked> {
    const id = ++latestCheck.current
    inFlight.current = key
    const found = await api.checkOnboarding(JSON.parse(key)).finally(() => {
      if (id === latestCheck.current) inFlight.current = null
    })
    const result = { key, findings: pageFindings(found.findings), failed: false }
    if (id === latestCheck.current) setChecked(result)
    return result
  }

  // The live check: 800ms after the last change. A failure shows nothing; Continue tries again.
  useEffect(() => {
    if (inputKey === checked.key || inputKey === inFlight.current) return
    const timer = setTimeout(() => {
      check(inputKey).catch(() => setChecked({ key: inputKey, findings: [], failed: true }))
    }, LIVE_CHECK_MS)
    return () => clearTimeout(timer)
  })

  function update(patch: Partial<Answers> | ((a: Answers) => Answers)) {
    setAnswers((a) => (typeof patch === "function" ? patch(a) : { ...a, ...patch }))
  }

  function goTo(nextStep: number) {
    setStep(nextStep)
    setPageStart(answers)
    setChecked({ key: null, findings: [], failed: false })
    setShowAll(false)
  }

  function finish() {
    setFinishing(true)
    router.replace(AFTER_AUTH_URL)
    router.refresh() // the chat layout reads the new onboarding status on the server
  }

  const next = useFormSubmit(async () => {
    if (step === 1 && isUnder16(answers.birthDate)) return setTooYoung(true)
    setShowAll(true)
    // Sex is picked with a card, not a form field, so the browser's "required" can't check it.
    if (step === 2 && !answers.sex) return

    let current = checked
    if (checked.key !== inputKey || checked.failed) {
      try {
        current = await check(inputKey)
      } catch (e) {
        return void toast.error(errorMessage(e))
      }
    }
    if (current.findings.some((f) => f.code === "under_16")) return setTooYoung(true)
    if (current.findings.some((f) => f.severity === "error")) return // warnings don't stop you

    if (step < STEPS) return goTo(step + 1)

    try {
      await api.submitOnboarding({ ...toInput(answers, STEPS), policy_version: PRIVACY_POLICY_VERSION })
      finish()
    } catch (e) {
      // Already saved (e.g. an earlier attempt worked but its answer got lost): nothing to fix.
      if (e instanceof ApiError && e.code === "already_onboarded") return finish()
      toast.error(errorMessage(e))
    }
  })

  // A field's check under it, once you've changed it and filled it in (or after Continue). While
  // a newer answer is being checked, the last message stays until the new result replaces it.
  function notes(field: string) {
    let finding: Finding | undefined
    if (field === "sex") {
      // A card pick: nothing to check live, only "required" after Continue.
      if (showAll && !answers.sex) finding = SEX_REQUIRED
    } else if (showAll || (changedFields(pageStart, answers).includes(field) && isComplete(answers, field))) {
      finding = checked.findings.find((f) => f.field === field)
    }
    return <FieldCheck finding={finding} units={answers.units} />
  }

  const footer = (back?: () => void) => (
    <div className="flex items-center justify-between">
      {back ? <BackButton onClick={back} /> : <span />}
      <TextAction onClick={() => signOut({ redirectUrl: SIGN_IN_URL })}>{t("signOut")}</TextAction>
    </div>
  )

  if (finishing) return <LogoLoader label={t("finishing")} />
  if (consentOnly) return <ConsentOnly footer={footer()} onDone={finish} />

  if (tooYoung) {
    return (
      <FlowShell title={t("tooYoung.title", { brand: brand.name })} description={t("tooYoung.description", { brand: brand.name })} footer={footer(() => setTooYoung(false))}>
        {null}
      </FlowShell>
    )
  }

  const steps = {
    1: { title: t("start.title"), description: undefined, body: <StartStep answers={answers} update={update} notes={notes} /> },
    2: { title: t("body.title"), description: undefined, body: <BodyStep answers={answers} update={update} convert={(to) => update((a) => convertUnits(a, to))} notes={notes} /> },
    3: { title: t("groups.title"), description: t("groups.description"), body: <GroupsStep answers={answers} update={update} notes={notes} /> },
    4: { title: t("level.title"), description: undefined, body: <LevelStep answers={answers} update={update} notes={notes} /> },
  }[step]!

  return (
    <FlowShell wide={step === 4} eyebrow={t("step", { n: step, total: STEPS })} title={steps.title} description={steps.description} footer={footer(step > 1 ? () => goTo(step - 1) : undefined)}>
      <form method="post" onSubmit={next.onSubmit} className="space-y-6">
        {steps.body}
        <SubmitButton pending={next.busy}>{step < STEPS ? t("continue") : t("finish")}</SubmitButton>
      </form>
    </FlowShell>
  )
}

/** After a policy change: read it, then continue (the profile is already there). */
function ConsentOnly({ footer, onDone }: { footer: React.ReactNode; onDone: () => void }) {
  const t = useTranslations("onboarding")
  const errorMessage = useErrorMessage()

  const submit = useFormSubmit(async () => {
    try {
      await api.giveConsent(PRIVACY_POLICY_VERSION)
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  return (
    <FlowShell title={t("consentOnly.title")} description={t("consentOnly.description", { brand: brand.name })} footer={footer}>
      <form method="post" onSubmit={submit.onSubmit} className="space-y-5">
        <ConsentLine />
        <SubmitButton pending={submit.busy}>{t("continue")}</SubmitButton>
      </form>
    </FlowShell>
  )
}
