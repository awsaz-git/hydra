import { useEffect, useState } from "react"

/** The value once it has stopped changing for `delay` ms; the previous one until then. */
export function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return settled
}
