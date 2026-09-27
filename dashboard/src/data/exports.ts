import { downloadCsv, isoLocal, stamp, toCsv } from '../lib/csv'
import { GALLERY_BY_ID, LANG_NAME, MODE_NAME, TOPICS } from './catalog'
import { artifactStats, durationMin, queriesOf, sessionsIn } from './selectors'
import { getArtifact, getArtifacts } from './store'
import type { Session } from './types'

/** One row per visit: the attendee export curators asked for. */
export function exportVisitors(list: Session[], label: string) {
  const csv = toCsv(list, [
    { header: 'visitor_id', value: (s) => s.id },
    { header: 'device', value: (s) => s.deviceId },
    { header: 'language', value: (s) => LANG_NAME[s.lang] },
    { header: 'mode', value: (s) => MODE_NAME[s.mode] },
    { header: 'group', value: (s) => s.group },
    { header: 'started_at', value: (s) => isoLocal(s.startedAt) },
    { header: 'ended_at', value: (s) => isoLocal(s.endedAt) },
    { header: 'duration_min', value: (s) => (s.endedAt ? Math.round(durationMin(s)) : '') },
    { header: 'artifacts_tapped', value: (s) => s.stops.length },
    { header: 'artifacts_list', value: (s) => s.stops.map((x) => getArtifact(x.artifactId)?.name ?? x.artifactId).join('; ') },
    { header: 'questions', value: (s) => queriesOf(s).length },
    { header: 'unanswered', value: (s) => queriesOf(s).filter((q) => q.status === 'unanswered').length },
    { header: 'narrations_skipped', value: (s) => s.stops.filter((x) => x.skipped).length },
    { header: 'rating', value: (s) => s.rating },
    { header: 'review', value: (s) => s.review?.textEn },
  ])
  downloadCsv(`musemate-visitors-${label}-${stamp()}.csv`, csv)
}

/** One row per question, in the visitor's script and in English. */
export function exportQueries(list: Session[], label: string) {
  const rows = list.flatMap(queriesOf).sort((a, b) => a.at - b.at)
  const csv = toCsv(rows, [
    { header: 'query_id', value: (q) => q.id },
    { header: 'visitor_id', value: (q) => q.sessionId },
    { header: 'asked_at', value: (q) => isoLocal(q.at) },
    { header: 'artifact_id', value: (q) => q.artifactId },
    { header: 'artifact', value: (q) => (q.artifactId ? getArtifact(q.artifactId)?.name : '(not about an artifact)') },
    { header: 'language', value: (q) => LANG_NAME[q.lang] },
    { header: 'question', value: (q) => q.text },
    { header: 'question_en', value: (q) => q.textEn },
    { header: 'topic', value: (q) => TOPICS[q.topic].label },
    { header: 'status', value: (q) => q.status },
    { header: 'answer_ms', value: (q) => q.latencyMs },
  ])
  downloadCsv(`musemate-questions-${label}-${stamp()}.csv`, csv)
}

export function exportArtifacts(v: number, from: number, to: number, label: string) {
  const stats = artifactStats(v, from, to)
  const csv = toCsv(getArtifacts(), [
    { header: 'artifact_id', value: (a) => a.id },
    { header: 'accession', value: (a) => a.accession },
    { header: 'name', value: (a) => a.name },
    { header: 'gallery', value: (a) => `${GALLERY_BY_ID[a.gallery].room} ${GALLERY_BY_ID[a.gallery].name}` },
    { header: 'period', value: (a) => a.period },
    { header: 'verified', value: (a) => (a.verified ? 'yes' : 'no') },
    { header: 'taps', value: (a) => stats.get(a.id)?.taps },
    { header: 'visitors', value: (a) => stats.get(a.id)?.visitors },
    { header: 'avg_dwell_sec', value: (a) => Math.round(stats.get(a.id)?.avgDwellSec ?? 0) },
    { header: 'skip_rate', value: (a) => (stats.get(a.id)?.skipRate ?? 0).toFixed(3) },
    { header: 'replay_rate', value: (a) => (stats.get(a.id)?.replayRate ?? 0).toFixed(3) },
    { header: 'tag_retry_rate', value: (a) => (stats.get(a.id)?.retryRate ?? 0).toFixed(3) },
    { header: 'questions', value: (a) => stats.get(a.id)?.queries },
    { header: 'unanswered_rate', value: (a) => (stats.get(a.id)?.unansweredRate ?? 0).toFixed(3) },
  ])
  downloadCsv(`musemate-artifacts-${label}-${stamp()}.csv`, csv)
}

export function sessionsForExport(v: number, from: number, to: number) {
  return [...sessionsIn(v, from, to)].sort((a, b) => a.startedAt - b.startedAt)
}
