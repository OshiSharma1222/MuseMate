import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { DAY, dayStart } from '../data/seed'
import { useVersion } from '../data/store'

export type RangeKey = 'today' | '7d' | '30d'

export interface Range {
  key: RangeKey
  from: number
  to: number
  /** The period the deltas compare against. */
  prevFrom: number
  prevTo: number
  label: string
  prevLabel: string
  bucket: 'hour' | 'day'
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
]

export function rangeFor(key: RangeKey, now = Date.now()): Range {
  const today = dayStart(now)
  if (key === 'today') {
    // Compare with the same weekday last week; yesterday is a different kind of day.
    return {
      key,
      from: today,
      to: now,
      prevFrom: today - 7 * DAY,
      prevTo: now - 7 * DAY,
      label: 'Today',
      prevLabel: 'same time last week',
      bucket: 'hour',
    }
  }
  const days = key === '7d' ? 7 : 30
  const from = today - (days - 1) * DAY
  return {
    key,
    from,
    to: now,
    prevFrom: from - days * DAY,
    prevTo: now - days * DAY,
    label: `Last ${days} days`,
    prevLabel: `previous ${days} days`,
    bucket: 'day',
  }
}

const RangeContext = createContext<{ range: Range; setKey: (k: RangeKey) => void } | null>(null)

const KEY = 'mm-range'

export function RangeProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<RangeKey>(() => {
    try {
      const v = localStorage.getItem(KEY)
      if (v === 'today' || v === '7d' || v === '30d') return v
    } catch {
      // fall through to the default
    }
    return '7d'
  })
  const version = useVersion()
  const range = useMemo(() => rangeFor(key), [key, version])
  const value = useMemo(
    () => ({
      range,
      setKey: (k: RangeKey) => {
        setKeyState(k)
        try {
          localStorage.setItem(KEY, k)
        } catch {
          // not persisted; fine
        }
      },
    }),
    [range],
  )
  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>
}

export function useRange() {
  const ctx = useContext(RangeContext)
  if (!ctx) throw new Error('useRange needs a RangeProvider')
  return ctx
}
