import { useSyncExternalStore } from 'react'
import { CATALOG, LANGS, MUSEUM, type CatalogEntry } from './catalog'
import {
  ENTRY_BY_ID,
  MIN,
  dayStart,
  deviceName,
  generate,
  makeQuery,
  makeRng,
  makeStop,
  nextEntry,
  sessionIdFor,
} from './seed'
import type { Artifact, Lang, Mode, Query, Session } from './types'

/*
  A small in-memory store standing in for the museum server's REST and
  WebSocket API. Sessions come from the seeded generator; artifact edits and
  resolved pain points persist in localStorage; the live feed appends taps and
  questions so the dashboard moves during a demo.
*/

type Listener = () => void
const listeners = new Set<Listener>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

function subscribe(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Re-renders the caller whenever the data changes; the value doubles as a memo key. */
export function useVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows can refuse storage; edits then last for the session only.
  }
}

// Sessions

const dataset = generate()
export const sessions: Session[] = dataset.sessions
const sessionById = new Map(sessions.map((s) => [s.id, s]))

export function getSession(id: string) {
  return sessionById.get(id)
}

// Artifacts

const EDITS_KEY = 'mm-artifact-edits'
let edits = load<Record<string, Partial<Artifact>>>(EDITS_KEY, {})

function nfcTagFor(id: string) {
  const rng = makeRng(parseInt(id.slice(1), 10) * 7919)
  const bytes = Array.from({ length: 6 }, () => rng.int(0, 255).toString(16).padStart(2, '0').toUpperCase())
  return ['04', ...bytes].join(':')
}

const CATALOGUED_AT = new Date('2026-07-14T11:20:00').getTime()

function fromCatalog(c: CatalogEntry): Artifact {
  const langs = LANGS.map((l) => l.id)
  return {
    id: c.id,
    accession: c.accession,
    nfcTag: nfcTagFor(c.id),
    name: c.name,
    kind: c.kind,
    gallery: c.gallery,
    period: c.period,
    region: c.region,
    material: c.material,
    dimensions: c.dimensions,
    description: c.description,
    curatorNotes: '',
    verified: !c.thin,
    narrationLangs: c.thin ? langs.slice(0, 2) : langs,
    updatedAt: CATALOGUED_AT,
  }
}

const baseArtifacts = CATALOG.map(fromCatalog)

export function getArtifacts(): Artifact[] {
  return baseArtifacts.map((a) => (edits[a.id] ? { ...a, ...edits[a.id] } : a))
}

export function getArtifact(id: string): Artifact | undefined {
  const a = baseArtifacts.find((x) => x.id === id)
  return a && (edits[id] ? { ...a, ...edits[id] } : a)
}

export function isEdited(id: string) {
  return Boolean(edits[id])
}

export function updateArtifact(id: string, patch: Partial<Artifact>) {
  edits = { ...edits, [id]: { ...edits[id], ...patch, updatedAt: Date.now() } }
  save(EDITS_KEY, edits)
  emit()
}

export function revertArtifact(id: string) {
  const { [id]: _, ...rest } = edits
  edits = rest
  save(EDITS_KEY, edits)
  emit()
}

// Pain points a curator has marked as dealt with

const RESOLVED_KEY = 'mm-resolved'
let resolved = load<Record<string, number>>(RESOLVED_KEY, {})

export function getResolved() {
  return resolved
}

export function setResolved(key: string, done: boolean) {
  const { [key]: _, ...rest } = resolved
  resolved = done ? { ...rest, [key]: Date.now() } : rest
  save(RESOLVED_KEY, resolved)
  emit()
}

// Live feed

export interface FeedEvent {
  id: string
  at: number
  kind: 'start' | 'tap' | 'query' | 'end'
  sessionId: string
  deviceId: string
  lang: Lang
  artifactId: string | null
  query?: Query
}

let feed: FeedEvent[] = []
let feedCounter = 0

function pushFeed(e: Omit<FeedEvent, 'id'>) {
  feed = [{ ...e, id: `F${++feedCounter}` }, ...feed].slice(0, 40)
}

export function getFeed() {
  if (!feed.length) primeFeed()
  return feed
}

/** Seeds the feed with the most recent real activity so it never starts empty. */
function primeFeed() {
  const recent = sessions.slice(-40)
  const events: Omit<FeedEvent, 'id'>[] = []
  for (const s of recent) {
    const base = { sessionId: s.id, deviceId: s.deviceId, lang: s.lang }
    events.push({ ...base, at: s.startedAt, kind: 'start', artifactId: null })
    for (const stop of s.stops) {
      events.push({ ...base, at: stop.at, kind: 'tap', artifactId: stop.artifactId })
      for (const q of stop.queries) events.push({ ...base, at: q.at, kind: 'query', artifactId: q.artifactId, query: q })
    }
    if (s.endedAt) events.push({ ...base, at: s.endedAt, kind: 'end', artifactId: null })
  }
  events.sort((a, b) => a.at - b.at)
  events.slice(-14).forEach(pushFeed)
}

const liveRng = makeRng(Date.now() % 2147483647)
let liveTimer: ReturnType<typeof setTimeout> | null = null
let liveOn = false

export function isLive() {
  return liveOn
}

function activeSessions() {
  const out: Session[] = []
  for (let i = sessions.length - 1; i >= 0 && out.length < 60; i--) {
    if (sessions[i].endedAt === null) out.push(sessions[i])
  }
  return out
}

export function getActiveCount() {
  return activeSessions().length
}

function startSession(at: number): Session {
  const day = dayStart(at)
  const seq = dataset.seqByDay.get(day) ?? 1
  dataset.seqByDay.set(day, seq + 1)
  const busy = new Set(activeSessions().map((s) => s.deviceId))
  const free = Array.from({ length: MUSEUM.devices }, (_, i) => deviceName(i + 1)).filter((d) => !busy.has(d))
  const lang = liveRng.weighted(LANGS, (l) => l.weight).id
  const mode = liveRng.weighted<Mode>(['default', 'quick', 'detailed', 'child'], (m) =>
    m === 'default' ? 0.5 : m === 'quick' ? 0.22 : m === 'detailed' ? 0.18 : 0.1,
  )
  const s: Session = {
    id: sessionIdFor(day, seq),
    deviceId: liveRng.pick(free.length ? free : [deviceName(1)]),
    lang,
    mode,
    group: mode === 'child' ? 'family' : 'solo',
    startedAt: at,
    endedAt: null,
    stops: [],
    looseQueries: [],
    rating: null,
    review: null,
  }
  sessions.push(s)
  sessionById.set(s.id, s)
  return s
}

function tap(s: Session, at: number): boolean {
  const seen = new Set(s.stops.map((x) => x.artifactId))
  const last = s.stops[s.stops.length - 1]
  const entry = nextEntry(liveRng, seen, last ? ENTRY_BY_ID[last.artifactId].gallery : null)
  if (!entry) return false
  const stop = makeStop(liveRng, { entry, lang: s.lang, mode: s.mode, at, sessionId: s.id, fatigue: s.stops.length / 22 })
  stop.queries = []
  s.stops.push(stop)
  return true
}

function ask(s: Session, at: number): Query | null {
  const last = s.stops[s.stops.length - 1]
  if (!last) return null
  const q = makeQuery(liveRng, { entry: ENTRY_BY_ID[last.artifactId], lang: s.lang, mode: s.mode, at, sessionId: s.id })
  last.queries.push(q)
  return q
}

function end(s: Session, at: number) {
  s.endedAt = at
  if (liveRng.chance(0.4)) s.rating = liveRng.weighted([5, 4, 3], (r) => (r === 5 ? 0.55 : r === 4 ? 0.33 : 0.12))
}

/** Outside opening hours there is nobody inside, so the demo brings a few visitors in. */
function ensureVisitors() {
  const now = Date.now()
  while (activeSessions().length < 6) {
    const s = startSession(now - liveRng.range(4, 35) * MIN)
    let t = s.startedAt + 2 * MIN
    const n = liveRng.int(1, 6)
    for (let i = 0; i < n && t < now; i++) {
      if (!tap(s, t)) break
      t += s.stops[s.stops.length - 1].dwellSec * 1000 + 40_000
    }
  }
  sessions.sort((a, b) => a.startedAt - b.startedAt)
}

function step() {
  const now = Date.now()
  const active = activeSessions()
  const r = liveRng.next()
  if (r < 0.12 || active.length < 3) {
    const s = startSession(now)
    pushFeed({ at: now, kind: 'start', sessionId: s.id, deviceId: s.deviceId, lang: s.lang, artifactId: null })
  } else if (r < 0.2) {
    const s = liveRng.pick(active.filter((x) => x.stops.length >= 4).concat(active).slice(0, 8))
    end(s, now)
    pushFeed({ at: now, kind: 'end', sessionId: s.id, deviceId: s.deviceId, lang: s.lang, artifactId: null })
  } else if (r < 0.72) {
    const s = liveRng.pick(active)
    if (tap(s, now)) {
      const stop = s.stops[s.stops.length - 1]
      pushFeed({ at: now, kind: 'tap', sessionId: s.id, deviceId: s.deviceId, lang: s.lang, artifactId: stop.artifactId })
    } else {
      end(s, now)
      pushFeed({ at: now, kind: 'end', sessionId: s.id, deviceId: s.deviceId, lang: s.lang, artifactId: null })
    }
  } else {
    const s = liveRng.pick(active.filter((x) => x.stops.length > 0))
    const q = s && ask(s, now)
    if (s && q) {
      pushFeed({ at: now, kind: 'query', sessionId: s.id, deviceId: s.deviceId, lang: s.lang, artifactId: q.artifactId, query: q })
    }
  }
  emit()
}

function schedule() {
  liveTimer = setTimeout(() => {
    step()
    schedule()
  }, liveRng.range(2200, 4200))
}

export function setLive(on: boolean) {
  if (on === liveOn) return
  liveOn = on
  if (on) {
    ensureVisitors()
    feed = []
    primeFeed()
    schedule()
  } else if (liveTimer) {
    clearTimeout(liveTimer)
    liveTimer = null
  }
  emit()
}
