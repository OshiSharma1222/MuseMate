const intFmt = new Intl.NumberFormat('en-IN')
const oneDp = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Indian digit grouping: 1,23,456. */
export const fmtInt = (n: number) => intFmt.format(Math.round(n))

export const fmt1 = (n: number) => oneDp.format(n)

export function fmtCompact(n: number) {
  if (n >= 100_000) return `${fmt1(n / 100_000)}L`
  if (n >= 10_000) return `${fmt1(n / 1000)}K`
  return fmtInt(n)
}

export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

/** 83 → "1m 23s", 42 → "42s". */
export function fmtSec(sec: number) {
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

/** Minutes as "58 min" or "1 h 12 min". */
export function fmtMin(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function fmtDateShort(ts: number) {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const fmtDate = (ts: number) => `${DAYS[new Date(ts).getDay()]} ${fmtDateShort(ts)}`

export const fmtDateTime = (ts: number) => `${fmtDate(ts)}, ${fmtTime(ts)}`

export function fmtAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return fmtDate(ts)
}

export function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

/** Signed change for a delta chip; null when there is nothing to compare. */
export function change(cur: number, prev: number): number | null {
  if (!prev) return null
  return (cur - prev) / prev
}
