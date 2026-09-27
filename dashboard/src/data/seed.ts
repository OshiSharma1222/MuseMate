import {
  CATALOG,
  FACILITY_QUESTIONS,
  GALLERIES,
  GENERIC_QUESTIONS,
  LANGS,
  LANG_NAME,
  MUSEUM,
  REVIEW_TEMPLATES,
  TOPIC_ANSWER_RATE,
  type CatalogEntry,
  type QuestionTemplate,
} from './catalog'
import type { GroupType, Lang, Mode, Query, Review, ReviewTag, Session, Stop } from './types'

/*
  Generates the visit history the dashboard runs on until the museum server
  is wired up. It is seeded, so every reload shows the same museum, and it is
  shaped to contain the problems a curator should be able to find: thin
  catalogue entries, a WiFi dead zone in Arms & Armour, NFC tags behind thick
  glass in Bronzes, a Tamil voice that needs work, and visitors running out of
  time or battery before Textiles.
*/

export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

export interface Rng {
  next(): number
  range(a: number, b: number): number
  int(a: number, b: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  weighted<T>(items: readonly T[], weight: (t: T) => number): T
  normal(mean?: number, sd?: number): number
  poisson(mean: number): number
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted(items, weight) {
      const total = items.reduce((s, t) => s + weight(t), 0)
      let r = next() * total
      for (const t of items) {
        r -= weight(t)
        if (r <= 0) return t
      }
      return items[items.length - 1]
    },
    normal(mean = 0, sd = 1) {
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    poisson(mean) {
      const l = Math.exp(-mean)
      let k = 0
      let p = 1
      do {
        k++
        p *= next()
      } while (p > l)
      return k - 1
    },
  }
  return rng
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

let queryCounter = 0
const nextQueryId = () => `Q${(++queryCounter).toString(36).toUpperCase().padStart(5, '0')}`

export const ENTRY_BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c])) as Record<string, CatalogEntry>

const GALLERY_ORDER = GALLERIES.map((g) => g.id)

const NARRATION_SEC: Record<Mode, number> = { quick: 30, default: 75, detailed: 150, child: 60 }
const QUESTION_RATE: Record<Mode, number> = { quick: 0.09, default: 0.22, detailed: 0.38, child: 0.42 }
const VISIT_RATE: Record<Mode, number> = { quick: 0.66, default: 0.82, detailed: 0.95, child: 0.78 }
const SKIP_FACTOR: Record<Mode, number> = { quick: 0.7, default: 1, detailed: 1.35, child: 0.9 }
const BUDGET_MIN: Record<Mode, [number, number]> = {
  quick: [22, 45],
  default: [38, 85],
  detailed: [60, 120],
  child: [30, 65],
}

export function makeQuery(
  rng: Rng,
  opts: { entry: CatalogEntry | null; lang: Lang; mode: Mode; at: number; sessionId: string },
): Query {
  const { entry, lang, mode, at, sessionId } = opts
  let tpl: QuestionTemplate
  let specific = false
  if (!entry) {
    tpl = rng.pick(FACILITY_QUESTIONS)
  } else {
    const preferSpecific = mode === 'child' ? 0.75 : 0.55
    specific = rng.chance(preferSpecific)
    tpl = specific ? rng.pick(entry.questions) : rng.pick(GENERIC_QUESTIONS)
  }

  let status: Query['status']
  if (tpl.topic === 'value') {
    status = 'declined'
  } else {
    const gapTopic = tpl.topic === 'provenance' || tpl.topic === 'restoration' || tpl.topic === 'media'
    let rate = specific && !gapTopic ? 0.93 : TOPIC_ANSWER_RATE[tpl.topic]
    if (entry?.thin) rate *= 0.42
    status = rng.chance(rate) ? 'answered' : 'unanswered'
  }

  const deadZone = entry?.gallery === 'arms'
  const base = deadZone ? rng.range(3800, 9200) : rng.range(1100, 3100)
  const latencyMs = Math.round(base + (status === 'unanswered' ? 400 : 0))

  return {
    id: nextQueryId(),
    sessionId,
    artifactId: entry?.id ?? null,
    at,
    lang,
    text: lang === 'hi' ? tpl.hi : tpl.en,
    textEn: tpl.en,
    topic: tpl.topic,
    status,
    latencyMs,
  }
}

export function makeStop(
  rng: Rng,
  opts: { entry: CatalogEntry; lang: Lang; mode: Mode; at: number; sessionId: string; fatigue: number },
): Stop {
  const { entry, lang, mode, at, sessionId, fatigue } = opts
  const tapRetries = entry.hardTag ? (rng.chance(0.34) ? rng.int(1, 3) : 0) : rng.chance(0.03) ? 1 : 0
  const narration = NARRATION_SEC[mode] * rng.range(0.8, 1.25)
  const skipP = clamp(entry.skipBias * SKIP_FACTOR[mode] * (1 + fatigue * 0.6), 0, 0.9)
  const skipped = rng.chance(skipP)
  const listenedPct = skipped ? rng.range(0.08, 0.48) : rng.range(0.86, 1)
  const replays = !skipped && rng.chance(mode === 'child' ? 0.16 : 0.07) ? (rng.chance(0.2) ? 2 : 1) : 0

  const qMean = QUESTION_RATE[mode] * (0.55 + entry.appeal * 0.9)
  const nq = skipped ? 0 : rng.poisson(qMean)
  const tapAt = at + tapRetries * rng.range(3000, 7000)
  const listenedMs = narration * listenedPct * 1000 * (1 + replays)
  const queries: Query[] = []
  for (let i = 0; i < nq; i++) {
    queries.push(
      makeQuery(rng, { entry, lang, mode, sessionId, at: tapAt + listenedMs + i * rng.range(18_000, 40_000) }),
    )
  }
  const dwellSec = Math.round(
    (tapAt - at) / 1000 + (listenedMs / 1000) + nq * rng.range(22, 38) + rng.range(8, 35),
  )

  return {
    artifactId: entry.id,
    at,
    dwellSec,
    listenedPct: Math.round(listenedPct * 100) / 100,
    skipped,
    replays,
    tapRetries,
    queries,
  }
}

/** Picks the artifact a visitor is likely to tap next after the ones they have seen. */
export function nextEntry(rng: Rng, seen: Set<string>, lastGallery: string | null): CatalogEntry | null {
  const from = lastGallery ? GALLERY_ORDER.indexOf(lastGallery as never) : 0
  for (let g = from; g < GALLERY_ORDER.length; g++) {
    const options = CATALOG.filter((c) => c.gallery === GALLERY_ORDER[g] && !seen.has(c.id))
    if (options.length && (g === from ? rng.chance(0.8) : true)) {
      return rng.weighted(options, (c) => c.appeal ** 2)
    }
  }
  return null
}

interface VisitPlan {
  id: string
  deviceId: string
  lang: Lang
  mode: Mode
  group: GroupType
  startedAt: number
}

function simulateVisit(rng: Rng, plan: VisitPlan): Session {
  const { lang, mode, id } = plan
  const [lo, hi] = BUDGET_MIN[mode]
  const budget = rng.range(lo, hi) * MIN * (plan.group === 'tour' ? 1.2 : 1)
  let t = plan.startedAt + rng.range(1.5, 4) * MIN
  const stops: Stop[] = []

  for (const gallery of GALLERY_ORDER) {
    if (t - plan.startedAt > budget) break
    if (rng.chance(0.1)) continue
    const inGallery = CATALOG.filter((c) => c.gallery === gallery)
    for (const entry of inGallery) {
      const elapsed = t - plan.startedAt
      if (elapsed > budget) break
      const p = clamp(entry.appeal * VISIT_RATE[mode] + 0.12, 0.05, 0.97)
      if (!rng.chance(p)) continue
      const stop = makeStop(rng, { entry, lang, mode, at: t, sessionId: id, fatigue: elapsed / budget })
      stops.push(stop)
      t += stop.dwellSec * 1000 + rng.range(15, 70) * 1000
    }
    t += rng.range(50, 150) * 1000
  }

  const looseQueries: Query[] = []
  if (rng.chance(plan.group === 'family' ? 0.2 : 0.12)) {
    const at = rng.range(plan.startedAt + 5 * MIN, Math.max(plan.startedAt + 6 * MIN, t))
    looseQueries.push(makeQuery(rng, { entry: null, lang, mode, at, sessionId: id }))
  }

  const endedAt = t + rng.range(1, 4) * MIN
  return { ...plan, endedAt, stops, looseQueries, rating: null, review: null }
}

function reviewFor(rng: Rng, s: Session): { rating: number; review: Review | null } | null {
  if (!rng.chance(0.42)) return null
  const queries = s.stops.flatMap((x) => x.queries).concat(s.looseQueries)
  const unanswered = queries.filter((q) => q.status === 'unanswered')
  const retried = s.stops.some((x) => x.tapRetries >= 2)
  const slow = queries.some((q) => q.latencyMs > 6000)
  const durationMin = ((s.endedAt ?? s.startedAt) - s.startedAt) / MIN
  const battery = durationMin > 95 && rng.chance(0.35)
  const voice = s.lang === 'ta' && rng.chance(0.55)
  const skippedMany = s.stops.filter((x) => x.skipped).length >= 4

  let score = 4.75
  if (voice) score -= 1.1
  if (unanswered.length >= 2) score -= 0.6
  if (retried) score -= 0.5
  if (battery) score -= 1.2
  if (slow) score -= 0.4
  if (skippedMany && s.mode === 'detailed') score -= 0.5
  if (s.mode === 'child') score += 0.25
  const rating = clamp(Math.round(score + rng.normal(0, 0.55)), 1, 5)

  if (!rng.chance(0.5)) return { rating, review: null }

  const negatives: ReviewTag[] = []
  if (voice) negatives.push('voice-quality')
  if (battery) negatives.push('battery')
  if (retried) negatives.push('tag-hard-to-find')
  if (slow) negatives.push('slow-answers')
  if (unanswered.some((q) => q.topic === 'facilities')) negatives.push('no-facilities')
  if (unanswered.some((q) => q.topic === 'provenance')) negatives.push('wanted-more')
  if (skippedMany && s.mode === 'detailed') negatives.push('narration-long')

  const positives: ReviewTag[] = []
  if (s.mode === 'child') positives.push('loved-child-mode')
  if (!['hi', 'en'].includes(s.lang)) positives.push('loved-language')
  if (queries.length >= 3) positives.push('loved-questions')
  positives.push('easy-to-use')

  const pool = rating <= 3 && negatives.length ? negatives : rating >= 4 ? positives : negatives.concat(positives)
  const tag = rng.pick(pool)
  const tags: ReviewTag[] = [tag]
  let en: string
  let text: string

  if (tag === 'loved-language') {
    const specific = REVIEW_TEMPLATES.find(
      (r) => r.tag === tag && r.en.includes(LANG_NAME[s.lang]),
    )
    en = specific?.en ?? `Wonderful to hear everything explained in ${LANG_NAME[s.lang]}.`
    text = en
  } else {
    const tpl = rng.pick(REVIEW_TEMPLATES.filter((r) => r.tag === tag))
    en = tpl.en
    text = s.lang === 'hi' && tpl.hi ? tpl.hi : tpl.en
  }
  if (rating <= 3 && positives.length && rng.chance(0.25)) tags.push(rng.pick(positives))

  return { rating, review: { rating, text, textEn: en, tags } }
}

function arrivalHour(rng: Rng) {
  const h = rng.chance(0.56) ? rng.normal(11.4, 0.85) : rng.normal(15.2, 1.0)
  return clamp(h, MUSEUM.opensAt + 0.02, MUSEUM.closesAt - 0.8)
}

const REGIONAL: Lang[] = ['ta', 'bn', 'mr', 'te', 'kn', 'ml', 'gu']

export function dayStart(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function sessionIdFor(dayTs: number, seq: number) {
  const d = new Date(dayTs)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `V-${mm}${dd}-${String(seq).padStart(3, '0')}`
}

export function deviceName(n: number) {
  return `MM-${String(n).padStart(2, '0')}`
}

/** Removes everything that would happen after `now`, so today looks mid-flight. */
function truncate(s: Session, now: number): Session | null {
  if (s.startedAt > now) return null
  if (s.endedAt !== null && s.endedAt <= now) return s
  const stops = s.stops
    .filter((x) => x.at <= now)
    .map((x) => ({ ...x, queries: x.queries.filter((q) => q.at <= now) }))
  return {
    ...s,
    stops,
    looseQueries: s.looseQueries.filter((q) => q.at <= now),
    endedAt: null,
    rating: null,
    review: null,
  }
}

export interface Dataset {
  sessions: Session[]
  /** Next free visitor number per day, so live sessions continue the sequence. */
  seqByDay: Map<number, number>
}

export function generate(now = Date.now(), days = 60, seed = 26214): Dataset {
  const rng = makeRng(seed)
  queryCounter = 0
  const sessions: Session[] = []
  const seqByDay = new Map<number, number>()
  const today = dayStart(now)

  for (let d = days - 1; d >= 0; d--) {
    const day = dayStart(today - d * DAY + 2 * HOUR)
    const weekday = new Date(day).getDay()
    if (weekday === MUSEUM.closedDay) continue

    // Visitor numbers grow as word of the guide spreads.
    const ramp = 0.72 + 0.28 * (1 - d / days)
    const base = weekday === 0 ? 178 : weekday === 6 ? 146 : 68
    const holiday = rng.chance(0.04) ? 1.6 : 1
    const count = Math.round(base * ramp * holiday * rng.range(0.86, 1.14))

    const plans: Omit<VisitPlan, 'id'>[] = []
    for (let i = 0; i < count; i++) {
      const group: GroupType = rng.chance(0.3) ? 'family' : 'solo'
      const lang = rng.weighted(LANGS, (l) => l.weight).id
      const mode: Mode =
        group === 'family' && rng.chance(0.38)
          ? 'child'
          : rng.weighted<Mode>(['default', 'quick', 'detailed', 'child'], (m) =>
              m === 'default' ? 0.5 : m === 'quick' ? 0.24 : m === 'detailed' ? 0.2 : 0.06,
            )
      plans.push({
        deviceId: '',
        lang,
        mode,
        group,
        startedAt: day + arrivalHour(rng) * HOUR,
      })
    }

    // School trips arrive together on weekday mornings, all in child mode.
    if (weekday >= 2 && weekday <= 5 && rng.chance(0.5)) {
      const size = rng.int(12, 26)
      const lang = rng.chance(0.55) ? 'hi' : rng.chance(0.5) ? 'en' : rng.pick(REGIONAL)
      const arrive = day + clamp(rng.normal(10.7, 0.35), 10.1, 12) * HOUR
      for (let i = 0; i < size; i++) {
        plans.push({ deviceId: '', lang, mode: 'child', group: 'school', startedAt: arrive + i * rng.range(8, 25) * 1000 })
      }
    }

    // Foreign tour groups, mostly detailed mode.
    if (rng.chance(0.22)) {
      const size = rng.int(4, 9)
      const lang = rng.pick<Lang>(['de', 'fr', 'en'])
      const arrive = day + rng.range(10.5, 14.5) * HOUR
      for (let i = 0; i < size; i++) {
        plans.push({
          deviceId: '',
          lang,
          mode: rng.chance(0.7) ? 'detailed' : 'default',
          group: 'tour',
          startedAt: arrive + i * rng.range(10, 30) * 1000,
        })
      }
    }

    plans.sort((a, b) => a.startedAt - b.startedAt)
    let seq = 0
    let lastKept = 0
    for (const p of plans) {
      seq++
      const id = sessionIdFor(day, seq)
      const visit = simulateVisit(rng, { ...p, id, deviceId: deviceName(rng.int(1, MUSEUM.devices)) })
      const rated = reviewFor(rng, visit)
      if (rated) {
        visit.rating = rated.rating
        visit.review = rated.review
      }
      const kept = truncate(visit, now)
      if (kept) {
        sessions.push(kept)
        lastKept = seq
      }
    }
    seqByDay.set(day, lastKept + 1)
  }

  return { sessions, seqByDay }
}
