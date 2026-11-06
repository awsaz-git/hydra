"use client"

import { useState, type FormEvent } from "react"

/**
 * Runs `action` with the form's data on submit and reports `busy` until it has
 * finished (all its steps, not just one request), so the button can show it.
 * A second submit while busy is ignored.
 */
export function useFormSubmit(action: (form: FormData) => Promise<void>) {
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const form = new FormData(e.currentTarget) // read now: currentTarget is gone after the await

    setBusy(true)
    try {
      await action(form)
    } finally {
      setBusy(false)
    }
  }

  return { onSubmit, busy }
}
