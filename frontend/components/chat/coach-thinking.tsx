"use client"

import { useEffect, useState } from "react"

import { CoachAvatar } from "@/components/chat/message"

const STEPS = [
  "Reading your history",
  "Checking your training rules",
  "Planning your answer",
  "Writing it up",
]

/** Shown while waiting for the coach: pulsing avatar + rotating, shimmering status text. */
export function CoachThinking() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // advance through the steps, then stay on the last one
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200)
    return () => clearInterval(timer) // cleanup when the reply arrives and this unmounts
  }, [])

  return (
    <div className="flex items-center gap-3 animate-in fade-in duration-300" role="status" aria-live="polite">
      <CoachAvatar thinking />
      {/* key={step} re-mounts the text so each new step fades in */}
      <span key={step} className="text-shimmer text-sm font-medium animate-in fade-in duration-500">
        {STEPS[step]}…
      </span>
    </div>
  )
}
