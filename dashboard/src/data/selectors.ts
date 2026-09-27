import { CATALOG, GALLERIES, LANGS, MODES, MUSEUM, REVIEW_TAGS, TOPICS } from './catalog'
import { DAY, HOUR, MIN, dayStart } from './seed'
import { getArtifacts, sessions } from './store'
import type { GalleryId, Lang, Mode, Query, ReviewTag, Session, Topic } from './types'

/*
  Every number on the dashboard is computed here from sessions, the same way
  the server would compute it from the events table. Results are memoised on
  the store version plus the arguments, so a page can call these freely.
*/

const cache = new Map<string, unknown>()
let cacheVersion = -1

function memo<T>(version: number, key: string, fn: () => T): T {
  if (version !== cacheVersion) {
    cache.clear()
    cacheVersion = version
  }
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key) as T
}

export const queriesOf = (s: Session): Query[] => s.stops.flatMap((x) => x.queries).concat(s.looseQueries)

export const durationMin = (s: Session, now = Date.now()) => ((s.endedAt ?? now) - s.startedAt) / MIN

export function sessionsIn(v: number, from: number, to: number): Session[] {
  return memo(v, `in:${from}:${to}`, () => sessions.filter((s) => s.startedAt >= from && s.startedAt < to))
}

export interface Summary {
  visitors: number
  active: number
  avgDurationMin: number
  queries: number
  queriesPerVisitor: number
  unanswered: number
  unansweredRate: number
  taps: number
  artifactsPerVisitor: number
  avgRating: number | null
  ratings: number
}

export function summary(v: number, from: number, to: number): Summary {
  return memo(v, `sum:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const done = list.filter((s) => s.endedAt !== null)
    const qs = list.flatMap(queriesOf)
    const counted = qs.filter((q) => q.status !== 'declined')
    const unanswered = counted.filter((q) => q.status === 'unanswered').length
    const taps = list.reduce((a, s) => a + s.stops.length, 0)
    const rated = list.filter((s) => s.rating !== null)
    return {
      visitors: list.length,
      active: list.filter((s) => s.endedAt === null).length,
      avgDurationMin: done.length ? done.reduce((a, s) => a + durationMin(s), 0) / done.length : 0,
      queries: qs.length,
      queriesPerVisitor: list.length ? qs.length / list.length : 0,
      unanswered,
      unansweredRate: counted.length ? unanswered / counted.length : 0,
      taps,
      artifactsPerVisitor: list.length ? taps / list.length : 0,
      avgRating: rated.length ? rated.reduce((a, s) => a + (s.rating ?? 0), 0) / rated.length : null,
      ratings: rated.length,
    }
  })
}

export interface Bucket {
  t: number
  visitors: number
  queries: number
  /** Same bucket in the comparison period. */
  prevVisitors: number
}

/** Arrivals per hour (today) or per day (longer ranges), with the comparison period aligned. */
export function attendance(v: number, r: { from: number; to: number; prevFrom: number; bucket: 'hour' | 'day' }) {
  return memo(v, `att:${r.from}:${r.to}:${r.bucket}`, () => {
    const size = r.bucket === 'hour' ? HOUR : DAY
    const cur = sessionsIn(v, r.from, r.to)
    const prev = sessionsIn(v, r.prevFrom, r.prevFrom + (r.to - r.from))
    const buckets = new Map<number, Bucket>()
    let start = r.from
    let end = r.to
    if (r.bucket === 'hour') {
      start = r.from + MUSEUM.opensAt * HOUR
      end = Math.max(r.from + MUSEUM.closesAt * HOUR, r.to)
      for (const s of cur) start = Math.min(start, s.startedAt - (s.startedAt % HOUR))
    }
    for (let t = start; t < end; t += size) {
      // A closed Monday is not a day nobody came; leave it out rather than plot a zero.
      if (r.bucket === 'day' && new Date(t + 2 * HOUR).getDay() === MUSEUM.closedDay) continue
      buckets.set(t, { t, visitors: 0, queries: 0, prevVisitors: 0 })
    }
    const slot = (ts: number) => (r.bucket === 'hour' ? ts - ((ts - r.from) % HOUR) : dayStart(ts))
    for (const s of cur) {
      const b = buckets.get(slot(s.startedAt))
      if (b) b.visitors++
      for (const q of queriesOf(s)) {
        const bq = buckets.get(slot(q.at))
        if (bq) bq.queries++
      }
    }
    const offset = r.from - r.prevFrom
    for (const s of prev) {
      const b = buckets.get(slot(s.startedAt + offset))
      if (b) b.prevVisitors++
    }
    return [...buckets.values()]
  })
}

/** How many visitors were inside at each 15-minute mark of a day. */
export function occupancy(v: number, day: number) {
  return memo(v, `occ:${day}`, () => {
    const list = sessionsIn(v, day, day + DAY)
    const step = 15 * MIN
    const out: { t: number; inside: number }[] = []
    const now = Date.now()
    for (let t = day + (MUSEUM.opensAt - 0.25) * HOUR; t <= day + (MUSEUM.closesAt + 0.5) * HOUR; t += step) {
      if (t > now) break
      out.push({ t, inside: list.filter((s) => s.startedAt <= t && (s.endedAt ?? now) > t).length })
    }
    return out
  })
}

export function languages(v: number, from: number, to: number) {
  return memo(v, `lang:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const rows = LANGS.map((l) => ({ lang: l.id as Lang, name: l.name, native: l.native, visitors: 0, queries: 0, rating: 0, rated: 0 }))
    const byId = new Map(rows.map((r) => [r.lang, r]))
    for (const s of list) {
      const r = byId.get(s.lang)!
      r.visitors++
      r.queries += queriesOf(s).length
      if (s.rating !== null) {
        r.rating += s.rating
        r.rated++
      }
    }
    return rows
      .map((r) => ({ ...r, share: list.length ? r.visitors / list.length : 0, avgRating: r.rated ? r.rating / r.rated : null }))
      .sort((a, b) => b.visitors - a.visitors)
  })
}

export function modes(v: number, from: number, to: number) {
  return memo(v, `mode:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    return MODES.map((m) => {
      const ms = list.filter((s) => s.mode === m.id)
      const done = ms.filter((s) => s.endedAt !== null)
      return {
        mode: m.id as Mode,
        name: m.name,
        visitors: ms.length,
        share: list.length ? ms.length / list.length : 0,
        avgMin: done.length ? done.reduce((a, s) => a + durationMin(s), 0) / done.length : 0,
      }
    })
  })
}

export interface ArtifactStat {
  id: string
  taps: number
  visitors: number
  queries: number
  unanswered: number
  unansweredRate: number
  avgDwellSec: number
  skipRate: number
  replayRate: number
  retryRate: number
  avgListened: number
  reach: number
}

export function artifactStats(v: number, from: number, to: number): Map<string, ArtifactStat> {
  return memo(v, `art:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const acc = new Map(
      CATALOG.map((c) => [
        c.id,
        { taps: 0, visitors: new Set<string>(), queries: 0, unanswered: 0, counted: 0, dwell: 0, skipped: 0, replays: 0, retried: 0, listened: 0 },
      ]),
    )
    for (const s of list) {
      for (const stop of s.stops) {
        const a = acc.get(stop.artifactId)
        if (!a) continue
        a.taps++
        a.visitors.add(s.id)
        a.dwell += stop.dwellSec
        a.listened += stop.listenedPct
        if (stop.skipped) a.skipped++
        if (stop.replays) a.replays++
        if (stop.tapRetries) a.retried++
        for (const q of stop.queries) {
          a.queries++
          if (q.status !== 'declined') a.counted++
          if (q.status === 'unanswered') a.unanswered++
        }
      }
    }
    const out = new Map<string, ArtifactStat>()
    for (const [id, a] of acc) {
      out.set(id, {
        id,
        taps: a.taps,
        visitors: a.visitors.size,
        queries: a.queries,
        unanswered: a.unanswered,
        unansweredRate: a.counted ? a.unanswered / a.counted : 0,
        avgDwellSec: a.taps ? a.dwell / a.taps : 0,
        skipRate: a.taps ? a.skipped / a.taps : 0,
        replayRate: a.taps ? a.replays / a.taps : 0,
        retryRate: a.taps ? a.retried / a.taps : 0,
        avgListened: a.taps ? a.listened / a.taps : 0,
        reach: list.length ? a.visitors.size / list.length : 0,
      })
    }
    return out
  })
}

/** Artifact-by-day query counts, for sparklines on the artifact page. */
export function artifactDaily(v: number, id: string, from: number, to: number) {
  return memo(v, `artday:${id}:${from}:${to}`, () => {
    const days = new Map<number, { t: number; taps: number; queries: number }>()
    for (let t = dayStart(from); t < to; t += DAY) days.set(dayStart(t + HOUR * 2), { t: dayStart(t + HOUR * 2), taps: 0, queries: 0 })
    for (const s of sessionsIn(v, from, to)) {
      for (const stop of s.stops) {
        if (stop.artifactId !== id) continue
        const d = days.get(dayStart(stop.at))
        if (!d) continue
        d.taps++
        d.queries += stop.queries.length
      }
    }
    return [...days.values()]
  })
}

export function queriesFor(v: number, artifactId: string, from: number, to: number) {
  return memo(v, `aq:${artifactId}:${from}:${to}`, () =>
    sessionsIn(v, from, to)
      .flatMap((s) => s.stops.filter((x) => x.artifactId === artifactId).flatMap((x) => x.queries))
      .sort((a, b) => b.at - a.at),
  )
}

export function queriesPerVisitorDist(v: number, from: number, to: number) {
  return memo(v, `qpv:${from}:${to}`, () => {
    const bins = [
      { label: '0', lo: 0, hi: 0 },
      { label: '1–2', lo: 1, hi: 2 },
      { label: '3–4', lo: 3, hi: 4 },
      { label: '5–6', lo: 5, hi: 6 },
      { label: '7–9', lo: 7, hi: 9 },
      { label: '10+', lo: 10, hi: Infinity },
    ].map((b) => ({ ...b, visitors: 0 }))
    for (const s of sessionsIn(v, from, to)) {
      const n = queriesOf(s).length
      bins.find((b) => n >= b.lo && n <= b.hi)!.visitors++
    }
    return bins
  })
}

export function durationHistogram(v: number, from: number, to: number) {
  return memo(v, `dur:${from}:${to}`, () => {
    const bins = Array.from({ length: 13 }, (_, i) => ({
      lo: i * 10,
      label: i === 12 ? '120+' : `${i * 10}`,
      visitors: 0,
    }))
    for (const s of sessionsIn(v, from, to)) {
      if (s.endedAt === null) continue
      bins[Math.min(12, Math.floor(durationMin(s) / 10))].visitors++
    }
    return bins
  })
}

export function dailyDuration(v: number, from: number, to: number) {
  return memo(v, `dd:${from}:${to}`, () => {
    const days = new Map<number, { t: number; total: number; n: number }>()
    for (const s of sessionsIn(v, from, to)) {
      if (s.endedAt === null) continue
      const d = dayStart(s.startedAt)
      const row = days.get(d) ?? { t: d, total: 0, n: 0 }
      row.total += durationMin(s)
      row.n++
      days.set(d, row)
    }
    return [...days.values()].sort((a, b) => a.t - b.t).map((d) => ({ t: d.t, avgMin: d.total / d.n, visitors: d.n }))
  })
}

/** Average arrivals per weekday × hour. Needs at least a week to mean anything. */
export function weekHeatmap(v: number, from: number, to: number) {
  return memo(v, `heat:${from}:${to}`, () => {
    const hours = Array.from({ length: MUSEUM.closesAt - MUSEUM.opensAt }, (_, i) => MUSEUM.opensAt + i)
    const grid = new Map<string, number>()
    const dayCount = new Map<number, Set<number>>()
    for (const s of sessionsIn(v, from, to)) {
      const d = new Date(s.startedAt)
      const wd = d.getDay()
      const h = d.getHours()
      grid.set(`${wd}:${h}`, (grid.get(`${wd}:${h}`) ?? 0) + 1)
      if (!dayCount.has(wd)) dayCount.set(wd, new Set())
      dayCount.get(wd)!.add(dayStart(s.startedAt))
    }
    // Monday first, as a curator's week reads.
    const order = [1, 2, 3, 4, 5, 6, 0]
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const rows = order.map((wd) => ({
      wd,
      name: names[wd],
      closed: wd === MUSEUM.closedDay,
      cells: hours.map((h) => {
        const days = dayCount.get(wd)?.size ?? 0
        return { h, value: days ? (grid.get(`${wd}:${h}`) ?? 0) / days : 0 }
      }),
    }))
    const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.value)))
    return { hours, rows, max }
  })
}

export function galleryStats(v: number, from: number, to: number) {
  return memo(v, `gal:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const stats = artifactStats(v, from, to)
    return GALLERIES.map((g) => {
      const ids = CATALOG.filter((c) => c.gallery === g.id).map((c) => c.id)
      const reached = list.filter((s) => s.stops.some((x) => ids.includes(x.artifactId))).length
      const qs = list.flatMap((s) => s.stops.filter((x) => ids.includes(x.artifactId)).flatMap((x) => x.queries))
      const taps = ids.reduce((a, id) => a + (stats.get(id)?.taps ?? 0), 0)
      const dwell = ids.reduce((a, id) => a + (stats.get(id)?.avgDwellSec ?? 0) * (stats.get(id)?.taps ?? 0), 0)
      return {
        id: g.id as GalleryId,
        name: g.name,
        room: g.room,
        reach: list.length ? reached / list.length : 0,
        reached,
        taps,
        avgDwellSec: taps ? dwell / taps : 0,
        queries: qs.length,
        avgLatencyMs: qs.length ? qs.reduce((a, q) => a + q.latencyMs, 0) / qs.length : 0,
      }
    })
  })
}

// Pain points

export type Severity = 'high' | 'medium' | 'low'

export interface Issue {
  key: string
  kind: 'content' | 'device' | 'experience'
  severity: Severity
  title: string
  detail: string
  metric: string
  affected: number
  /** What `affected` counts: visitors, taps, reviews. */
  affectedLabel: string
  artifacts: { id: string; name: string; count: number }[]
  samples: Query[]
  topic?: Topic
  action: string
}

const sev = (affected: number, visitors: number): Severity =>
  affected / Math.max(1, visitors) > 0.06 ? 'high' : affected / Math.max(1, visitors) > 0.02 ? 'medium' : 'low'

export function painPoints(v: number, from: number, to: number): Issue[] {
  return memo(v, `pain:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const visitors = list.length
    const names = new Map(getArtifacts().map((a) => [a.id, a.name]))
    const issues: Issue[] = []

    // Content gaps: topics the guide fails on across the whole collection.
    // Topics that only fail on a few thin entries are reported per artifact below.
    const byTopic = new Map<Topic, Query[]>()
    const topicTotal = new Map<Topic, number>()
    for (const s of list) for (const q of queriesOf(s)) {
      topicTotal.set(q.topic, (topicTotal.get(q.topic) ?? 0) + 1)
      if (q.status === 'unanswered') byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q])
    }
    for (const [topic, qs] of byTopic) {
      if (qs.length < 5 || qs.length / (topicTotal.get(topic) ?? 1) < 0.4) continue
      const perArtifact = new Map<string, number>()
      for (const q of qs) if (q.artifactId) perArtifact.set(q.artifactId, (perArtifact.get(q.artifactId) ?? 0) + 1)
      const artifacts = [...perArtifact.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id, count]) => ({ id, name: names.get(id) ?? id, count }))
      const seen = new Set<string>()
      const samples = qs.filter((q) => (seen.has(q.textEn) ? false : (seen.add(q.textEn), true))).slice(0, 4)
      const affected = new Set(qs.map((q) => q.sessionId)).size
      const isFacilities = topic === 'facilities'
      const isMedia = topic === 'media'
      issues.push({
        key: `topic:${topic}`,
        kind: isFacilities || isMedia ? 'experience' : 'content',
        severity: sev(affected, visitors),
        title: isFacilities
          ? 'Visitors ask for directions and facilities'
          : isMedia
            ? 'Visitors want to hear music the guide cannot play'
            : `No answer for “${TOPICS[topic].gapLabel.toLowerCase()}”`,
        detail: isFacilities
          ? 'The guide only knows the collection. Washroom, café, lift and exit questions go unanswered.'
          : isMedia
            ? 'Questions about ragas and instruments ask for audio clips that are not in the catalogue.'
            : `${qs.length} questions about ${TOPICS[topic].gapLabel.toLowerCase()} could not be answered from catalogue content.`,
        metric: `${qs.length} unanswered`,
        affected,
        affectedLabel: 'visitors',
        artifacts,
        samples,
        topic,
        action: isFacilities
          ? 'Add a facilities sheet (washrooms, café, lift, exits) to the knowledge base'
          : isMedia
            ? 'Record short audio clips for the Ragamala and veena entries'
            : `Add ${TOPICS[topic].gapLabel.toLowerCase()} notes to the artifacts listed`,
      })
    }

    const stats = artifactStats(v, from, to)

    // Thin catalogue entries: ordinary questions go unanswered.
    const systemic = new Set<Topic>(['provenance', 'restoration', 'media', 'value', 'facilities'])
    for (const s of stats.values()) {
      const qs = list
        .flatMap((x) => x.stops.filter((st) => st.artifactId === s.id).flatMap((st) => st.queries))
        .filter((q) => !systemic.has(q.topic))
      const un = qs.filter((q) => q.status === 'unanswered')
      const rate = un.length / Math.max(1, qs.length)
      if (qs.length < 10 || rate < 0.35) continue
      issues.push({
        key: `thin:${s.id}`,
        kind: 'content',
        severity: sev(new Set(un.map((q) => q.sessionId)).size * 3, visitors),
        title: `${names.get(s.id)} has too little content to answer from`,
        detail: `${Math.round(rate * 100)}% of everyday questions about it (what it is, who made it, what it means) went unanswered. Its catalogue description is a single line.`,
        metric: `${Math.round(rate * 100)}% unanswered`,
        affected: new Set(un.map((q) => q.sessionId)).size,
        affectedLabel: 'visitors',
        artifacts: [{ id: s.id, name: names.get(s.id) ?? s.id, count: un.length }],
        samples: un.slice(0, 3),
        action: 'Expand the description and verify it',
      })
    }

    // NFC tags that take more than one tap.
    const hard = [...stats.values()].filter((s) => s.taps >= 20 && s.retryRate > 0.15)
    if (hard.length) {
      const affected = Math.round(hard.reduce((a, s) => a + s.taps * s.retryRate, 0))
      issues.push({
        key: 'nfc-retries',
        kind: 'device',
        severity: sev(affected, visitors),
        title: 'NFC tags that need several taps',
        detail: `${hard.map((s) => names.get(s.id)).join(' and ')}: about ${Math.round((hard.reduce((a, s) => a + s.retryRate, 0) / hard.length) * 100)}% of taps needed a retry. The tags are likely behind thick glass or mounted too low.`,
        metric: `${fmtPctInline(hard.reduce((a, s) => a + s.retryRate, 0) / hard.length)} retry rate`,
        affected,
        affectedLabel: 'retried taps',
        artifacts: hard.map((s) => ({ id: s.id, name: names.get(s.id) ?? s.id, count: Math.round(s.taps * s.retryRate) })),
        samples: [],
        action: 'Move the tags to the front edge of the case at hand height',
      })
    }

    // Galleries where answers are slow: WiFi dead zones.
    const galleries = galleryStats(v, from, to)
    const withQs = galleries.filter((g) => g.queries > 20)
    const avgLatency = withQs.reduce((a, g) => a + g.avgLatencyMs * g.queries, 0) / Math.max(1, withQs.reduce((a, g) => a + g.queries, 0))
    for (const g of withQs) {
      if (g.avgLatencyMs < avgLatency * 1.6) continue
      issues.push({
        key: `slow:${g.id}`,
        kind: 'device',
        severity: 'high',
        title: `Slow answers in ${g.name}`,
        detail: `Answers take ${(g.avgLatencyMs / 1000).toFixed(1)} s here against ${(avgLatency / 1000).toFixed(1)} s across the museum, which points to weak WiFi in ${g.room}.`,
        metric: `${(g.avgLatencyMs / 1000).toFixed(1)} s per answer`,
        affected: g.reached,
        affectedLabel: 'visitors',
        artifacts: [],
        samples: [],
        action: `Add an access point in ${g.room} or cache its answers on the handhelds`,
      })
    }

    // Narrations people walk away from.
    const skipped = [...stats.values()].filter((s) => s.taps >= 20 && s.skipRate > 0.36).sort((a, b) => b.skipRate - a.skipRate)
    if (skipped.length) {
      issues.push({
        key: 'high-skip',
        kind: 'content',
        severity: 'medium',
        title: 'Narrations visitors cut short',
        detail: 'These narrations are stopped before half-way far more often than the rest. They may open too slowly, or the object may need a stronger hook.',
        metric: `${skipped.length} artifacts over 36% skipped`,
        affected: skipped.reduce((a, s) => a + Math.round(s.taps * s.skipRate), 0),
        affectedLabel: 'skipped narrations',
        artifacts: skipped.slice(0, 4).map((s) => ({ id: s.id, name: names.get(s.id) ?? s.id, count: Math.round(s.skipRate * 100) })),
        samples: [],
        action: 'Rewrite the first sentence of each narration and shorten it',
      })
    }

    // Visitors who never reach the last galleries.
    const last = galleries[galleries.length - 1]
    if (last && last.reach < 0.5) {
      issues.push({
        key: `dropoff:${last.id}`,
        kind: 'experience',
        severity: last.reach < 0.35 ? 'high' : 'medium',
        title: `Most visitors never reach ${last.name}`,
        detail: `Only ${Math.round(last.reach * 100)}% of visitors tapped anything in ${last.room}, the last room on the route. Visitors run out of time, energy or battery before they get there.`,
        metric: `${Math.round(last.reach * 100)}% reach`,
        affected: visitors - last.reached,
        affectedLabel: 'visitors',
        artifacts: [],
        samples: [],
        action: 'Offer a Textiles-first trail at the entrance and check battery at hand-out',
      })
    }

    // Complaints from reviews that no telemetry catches.
    const tagCount = new Map<ReviewTag, number>()
    for (const s of list) for (const t of s.review?.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    const voice = tagCount.get('voice-quality') ?? 0
    if (voice >= 3) {
      const ta = languages(v, from, to).find((l) => l.lang === 'ta')
      issues.push({
        key: 'voice-ta',
        kind: 'experience',
        severity: 'medium',
        title: 'Tamil narration voice gets poor reviews',
        detail: `${voice} reviews mention robotic speech or mispronounced names in Tamil. Tamil visitors rate the visit ${ta?.avgRating?.toFixed(1) ?? '–'} on average.`,
        metric: `${voice} reviews`,
        affected: voice,
        affectedLabel: 'reviews',
        artifacts: [],
        samples: [],
        action: 'Switch the Tamil voice model and add a pronunciation list for temple names',
      })
    }
    const battery = tagCount.get('battery') ?? 0
    if (battery >= 2) {
      issues.push({
        key: 'battery',
        kind: 'device',
        severity: 'low',
        title: 'Handhelds running out of battery',
        detail: `${battery} visitors on long visits said the device died before they finished.`,
        metric: `${battery} reviews`,
        affected: battery,
        affectedLabel: 'reviews',
        artifacts: [],
        samples: [],
        action: 'Swap devices below 40% at the counter',
      })
    }

    const rank = { high: 0, medium: 1, low: 2 }
    return issues.sort((a, b) => rank[a.severity] - rank[b.severity] || b.affected - a.affected)
  })
}

const fmtPctInline = (n: number) => `${Math.round(n * 100)}%`

// Reviews

export function reviewStats(v: number, from: number, to: number) {
  return memo(v, `rev:${from}:${to}`, () => {
    const list = sessionsIn(v, from, to)
    const rated = list.filter((s) => s.rating !== null)
    const dist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: rated.filter((s) => s.rating === r).length }))
    const tags = (Object.keys(REVIEW_TAGS) as ReviewTag[])
      .map((t) => ({ tag: t, ...REVIEW_TAGS[t], count: list.filter((s) => s.review?.tags.includes(t)).length }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
    const reviews = list.filter((s) => s.review).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    const byMode = MODES.map((m) => {
      const r = rated.filter((s) => s.mode === m.id)
      return { mode: m.id, name: m.name, avg: r.length ? r.reduce((a, s) => a + (s.rating ?? 0), 0) / r.length : null, n: r.length }
    })
    return {
      avg: rated.length ? rated.reduce((a, s) => a + (s.rating ?? 0), 0) / rated.length : null,
      rated: rated.length,
      responseRate: list.filter((s) => s.endedAt !== null).length ? rated.length / list.filter((s) => s.endedAt !== null).length : 0,
      dist,
      tags,
      reviews,
      byMode,
    }
  })
}
