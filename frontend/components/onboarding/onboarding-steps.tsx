"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  BodyPartMuscleIcon,
  BoxingGlove01Icon,
  Dumbbell01Icon,
  EquipmentGym03Icon,
  EquipmentWeightliftingIcon,
  FemaleSymbolIcon,
  FootballIcon,
  HeartPulseIcon,
  MaleSymbolIcon,
  WorkoutBattleRopesIcon,
  WorkoutRunIcon,
  WorkoutSquatsIcon,
} from "@hugeicons/core-free-icons"

import { Field } from "@/components/flow/field"
import { GroupInput, GroupSeparator, InputGroup } from "@/components/flow/input-group"
import { OptionCard, pickableCard } from "@/components/flow/option-card"
import { SegmentedSwitch } from "@/components/flow/segmented-switch"
import { LiveLevel } from "@/components/onboarding/level-meter"
import { PRIVACY_URL } from "@/lib/auth-routes"
import type { Answers } from "@/lib/onboarding"
import type { Lift, RaceDistance } from "@/lib/types"
import type { UnitSystem } from "@/lib/units"
import { cn } from "@/lib/utils"

type StepProps = {
  answers: Answers
  update: (patch: Partial<Answers> | ((a: Answers) => Answers)) => void
  /** The live check result shown under a field. */
  notes: (field: string) => ReactNode
}

// The athlete groups, shown in sections by where people train (owner, 2026-11-07).
const GROUP_SECTIONS = [
  { key: "weightRoom", groups: ["strength", "physique", "functional"] },
  { key: "fieldTrack", groups: ["endurance", "sport", "combat"] },
  { key: "health", groups: ["general"] },
] as const
const GROUP_ICONS: Record<string, IconSvgElement> = {
  strength: Dumbbell01Icon,
  physique: BodyPartMuscleIcon,
  functional: WorkoutBattleRopesIcon,
  endurance: WorkoutRunIcon,
  sport: FootballIcon,
  combat: BoxingGlove01Icon,
  general: HeartPulseIcon,
}
const LIFTS: { lift: Lift; icon: IconSvgElement }[] = [
  { lift: "squat", icon: WorkoutSquatsIcon },
  { lift: "bench", icon: EquipmentGym03Icon }, // a bench under a racked bar
  { lift: "deadlift", icon: EquipmentWeightliftingIcon }, // a figure lifting a barbell
]
const DISTANCES: RaceDistance[] = ["5k", "10k", "half", "full"]
// Where the level standards come from (services/levels.go names the exact tables).
const STANDARDS_URLS = {
  strength: "https://www.strengthlog.com/strength-standards/",
  running: "https://runninglevel.com/running-times/5k-times",
}

/** Page 1: date of birth, and the line that continuing means agreeing to the privacy policy. */
export function StartStep({ answers, update, notes }: StepProps) {
  const t = useTranslations("onboarding.start")
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="space-y-2">
        <Field id="birth-date" name="birthDate" type="date" label={t("birthDate")} required min="1900-01-01" max={today} value={answers.birthDate} onChange={(e) => update({ birthDate: e.target.value })} />
        {notes("birth_date")}
      </div>
      <ConsentLine />
    </>
  )
}

/** "By continuing, you agree to the privacy policy." The link opens a new tab (leaving would lose the answers). */
export function ConsentLine() {
  const t = useTranslations("onboarding.start")
  return (
    <p className="text-[13px] text-muted-foreground">
      {t.rich("consent", {
        link: (text) => (
          <Link href={PRIVACY_URL} target="_blank" rel="noopener" className="text-foreground underline underline-offset-4">
            {text}
          </Link>
        ),
      })}
    </p>
  )
}

/** Page 2: units, sex, then height and weight side by side (in the chosen units). */
export function BodyStep({ answers, update, notes, convert }: StepProps & { convert: (to: UnitSystem) => void }) {
  const t = useTranslations("onboarding.body")
  const metric = answers.units === "metric"

  return (
    <>
      <SegmentedSwitch label={t("units")} value={answers.units} onChange={convert} options={[{ value: "metric", label: t("metric") }, { value: "imperial", label: t("imperial") }]} />

      <div className="space-y-2">
        <p className="text-[13px] font-medium">{t("sex")}</p>
        <div role="radiogroup" aria-label={t("sex")} className="grid grid-cols-2 gap-3">
          <OptionCard compact role="radio" icon={MaleSymbolIcon} label={t("male")} selected={answers.sex === "male"} onClick={() => update({ sex: "male" })} />
          <OptionCard compact role="radio" icon={FemaleSymbolIcon} label={t("female")} selected={answers.sex === "female"} onClick={() => update({ sex: "female" })} />
        </div>
        {notes("sex")}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metric ? (
          <InputGroup label={t("height")} labelFor="height">
            <GroupInput id="height" name="height" type="number" inputMode="decimal" step="any" required unit="cm" value={answers.heightCm} onChange={(e) => update({ heightCm: e.target.value })} />
          </InputGroup>
        ) : (
          <InputGroup label={t("height")} labelFor="height-ft">
            <GroupInput id="height-ft" name="heightFt" type="number" inputMode="numeric" min={1} max={8} required unit={t("feet")} aria-label={`${t("height")} (${t("feet")})`} value={answers.heightFt} onChange={(e) => update({ heightFt: e.target.value })} />
            <GroupInput name="heightIn" type="number" inputMode="numeric" min={0} max={11} unit={t("inches")} aria-label={`${t("height")} (${t("inches")})`} value={answers.heightIn} onChange={(e) => update({ heightIn: e.target.value })} />
          </InputGroup>
        )}
        <InputGroup label={t("weight")} labelFor="weight">
          <GroupInput id="weight" name="weight" type="number" inputMode="decimal" step="any" required unit={metric ? "kg" : "lb"} value={answers.weight} onChange={(e) => update({ weight: e.target.value })} />
        </InputGroup>
      </div>
      {notes("height")}
      {notes("weight")}
    </>
  )
}

/** Page 3: the athlete groups (as many as apply), as icon cards in sections. */
export function GroupsStep({ answers, update, notes }: StepProps) {
  const t = useTranslations("onboarding.groups")

  function toggle(group: string) {
    update({ groups: answers.groups.includes(group) ? answers.groups.filter((g) => g !== group) : [...answers.groups, group] })
  }

  return (
    <>
      {GROUP_SECTIONS.map((section) => (
        <section key={section.key} className="space-y-2">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-hint">{t(`sections.${section.key}`)}</h2>
          <div className="grid grid-cols-3 gap-3">
            {section.groups.map((group) => {
              const selected = answers.groups.includes(group)
              return <OptionCard key={group} icon={GROUP_ICONS[group]} label={t(`names.${group}`)} selected={selected} onClick={() => toggle(group)} />
            })}
          </div>
        </section>
      ))}
      {notes("athlete_groups")}
    </>
  )
}

/**
 * Page 4: cards for the big three and the best race. Pick the ones you do; a picked card shows
 * one clean row: [weight] × [reps], or [distance] in [time]. Picking none is fine.
 */
export function LevelStep({ answers, update, notes }: StepProps) {
  const t = useTranslations("onboarding.level")
  const unit = answers.units === "metric" ? "kg" : "lb"
  const setLift = (lift: Lift, patch: Partial<Answers["lifts"][Lift]>) =>
    update((a) => ({ ...a, lifts: { ...a.lifts, [lift]: { ...a.lifts[lift], ...patch } } }))
  const setRace = (patch: Partial<Answers["race"]>) => update((a) => ({ ...a, race: { ...a.race, ...patch } }))

  return (
    <div className="space-y-3">
      {LIFTS.map(({ lift, icon }) => {
        const l = answers.lifts[lift]
        return (
          <LevelCard key={lift} icon={icon} label={t(`lifts.${lift}`)} selected={l.selected} onToggle={() => setLift(lift, { selected: !l.selected })} level={<LiveLevel answers={answers} card={lift} />}>
            <InputGroup>
              <GroupInput name={`${lift}Weight`} type="number" inputMode="decimal" step="any" required unit={unit} placeholder={t("weight")} aria-label={`${t(`lifts.${lift}`)}: ${t("weight")}`} value={l.weight} onChange={(e) => setLift(lift, { weight: e.target.value })} />
              <GroupSeparator>{t("times")}</GroupSeparator>
              <GroupInput name={`${lift}Reps`} type="number" inputMode="numeric" min={1} max={15} required placeholder={t("reps")} aria-label={`${t(`lifts.${lift}`)}: ${t("reps")}`} value={l.reps} onChange={(e) => setLift(lift, { reps: e.target.value })} />
            </InputGroup>
            {notes(lift)}
          </LevelCard>
        )
      })}

      <LevelCard icon={WorkoutRunIcon} label={t("race")} selected={answers.race.selected} onToggle={() => setRace({ selected: !answers.race.selected })} level={<LiveLevel answers={answers} card="race" />}>
        <InputGroup>
          <select
            name="raceDistance"
            aria-label={`${t("race")}: ${t("distance")}`}
            value={answers.race.distance}
            onChange={(e) => setRace({ distance: e.target.value as RaceDistance })}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          >
            {DISTANCES.map((d) => (
              <option key={d} value={d} className="bg-popover">
                {t(`distances.${answers.units}.${d}`)}
              </option>
            ))}
          </select>
          <GroupSeparator>{t("in")}</GroupSeparator>
          <GroupInput name="raceTime" required pattern="(\d{1,2}:)?\d{1,2}:\d{2}" placeholder={t("timePlaceholder")} aria-label={`${t("race")}: ${t("time")}`} value={answers.race.time} onChange={(e) => setRace({ time: e.target.value })} />
        </InputGroup>
        {notes("endurance")}
      </LevelCard>

      <p className="pt-1 text-[12px] text-hint">
        {t.rich("levelNote", {
          strength: (text) => <SourceLink href={STANDARDS_URLS.strength}>{text}</SourceLink>,
          running: (text) => <SourceLink href={STANDARDS_URLS.running}>{text}</SourceLink>,
        })}
      </p>
    </div>
  )
}

/**
 * A level card: its header picks it, and shows the live level on the right. Once picked, its
 * inputs slide open below the header (height + fade, 200ms). Closed, they stay in the page but
 * are disabled and inert: out of the tab order, and their "required" doesn't block Continue.
 */
function LevelCard({ icon, label, selected, onToggle, level, children }: { icon: IconSvgElement; label: string; selected: boolean; onToggle: () => void; level: ReactNode; children: ReactNode }) {
  return (
    <div className={cn(pickableCard(selected), "overflow-hidden")}>
      <div className="flex items-center gap-3 pe-4">
        <button type="button" aria-pressed={selected} onClick={onToggle} className="flex flex-1 items-center gap-3 py-3 ps-4 text-start text-[15px]">
          <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
          <span>{label}</span>
        </button>
        {selected && level}
      </div>
      <div
        inert={!selected}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        {/* overflow-hidden lets the row shrink to 0; pt-1 leaves room for the focus ring */}
        <fieldset disabled={!selected} className="min-h-0 min-w-0 overflow-hidden">
          <div className="space-y-2 px-4 pt-1 pb-4">{children}</div>
        </fieldset>
      </div>
    </div>
  )
}

/** A source link in the level note; a new tab, so the answers aren't lost. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
      {children}
    </a>
  )
}
