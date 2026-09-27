import { ArrowLeft, Check, CircleDashed, Nfc, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArtifactGlyph, StatusBadge, VisitorLink } from '../components/bits'
import { Sparkline } from '../components/charts'
import { Badge, Button, Card, CardHeader, Empty, LangTag, Meter, Mono, Segmented, Select, Toggle, cx } from '../components/ui'
import { GALLERIES, GALLERY_BY_ID, LANGS, TOPICS } from '../data/catalog'
import { coverage } from '../data/coverage'
import { artifactDaily, artifactStats, queriesFor } from '../data/selectors'
import { getArtifact, isEdited, revertArtifact, updateArtifact, useVersion } from '../data/store'
import type { Artifact, GalleryId, Lang, Topic } from '../data/types'
import { fmtAgo, fmtDateTime, fmtInt, fmtPct, fmtSec } from '../lib/format'
import { rangeFor, useRange } from '../lib/range'
import NotFound from './NotFound'

type Draft = Pick<
  Artifact,
  'name' | 'gallery' | 'period' | 'region' | 'material' | 'dimensions' | 'description' | 'curatorNotes' | 'verified' | 'narrationLangs'
>

const draftOf = (a: Artifact): Draft => ({
  name: a.name,
  gallery: a.gallery,
  period: a.period,
  region: a.region,
  material: a.material,
  dimensions: a.dimensions,
  description: a.description,
  curatorNotes: a.curatorNotes,
  verified: a.verified,
  narrationLangs: a.narrationLangs,
})

function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none'

export default function ArtifactDetail() {
  const { id = '' } = useParams()
  const v = useVersion()
  const { range } = useRange()
  const artifact = getArtifact(id)
  const [draft, setDraft] = useState<Draft | null>(artifact ? draftOf(artifact) : null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [qFilter, setQFilter] = useState<'all' | 'unanswered'>('all')

  useEffect(() => {
    const a = getArtifact(id)
    setDraft(a ? draftOf(a) : null)
    setSavedAt(null)
  }, [id])

  const dirty = useMemo(
    () => !!artifact && !!draft && JSON.stringify(draftOf(artifact)) !== JSON.stringify(draft),
    [artifact, draft],
  )

  if (!artifact || !draft) return <NotFound />

  const set = <K extends keyof Draft>(k: K, value: Draft[K]) => setDraft({ ...draft, [k]: value })
  const stats = artifactStats(v, range.from, range.to).get(id)!
  // A single day is too short for a trend, so the sparkline always covers a month.
  const month = rangeFor('30d')
  const daily = artifactDaily(v, id, month.from, month.to).filter((d) => new Date(d.t).getDay() !== 1)
  const questions = queriesFor(v, id, range.from, range.to)
  const shown = qFilter === 'all' ? questions : questions.filter((q) => q.status === 'unanswered')
  const topicCounts = new Map<Topic, { total: number; unanswered: number }>()
  for (const q of questions) {
    const t = topicCounts.get(q.topic) ?? { total: 0, unanswered: 0 }
    t.total++
    if (q.status === 'unanswered') t.unanswered++
    topicCounts.set(q.topic, t)
  }
  const topics = [...topicCounts.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6)
  const cov = coverage({ ...artifact, ...draft })
  const gallery = GALLERY_BY_ID[artifact.gallery]

  const save = () => {
    updateArtifact(id, draft)
    setSavedAt(Date.now())
  }

  return (
    <>
      <Link to="/artifacts" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Artifacts
      </Link>

      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <ArtifactGlyph kind={artifact.kind} size={60} />
          <div className="min-w-0">
            <div className="eyebrow mb-1.5 flex flex-wrap items-center gap-x-2">
              <span>
                {gallery.room} · {gallery.name}
              </span>
              <span className="font-mono tracking-normal normal-case">{artifact.accession}</span>
            </div>
            <h1 className="font-serif text-[38px] leading-[1.05] text-ink">{artifact.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {artifact.verified ? (
                <Badge tone="good">
                  <ShieldCheck size={12} strokeWidth={2.2} /> Verified for narration
                </Badge>
              ) : (
                <Badge tone="warn">
                  <TriangleAlert size={12} strokeWidth={2.2} /> Needs curator review
                </Badge>
              )}
              {isEdited(id) && <Badge tone="accent">Edited {fmtAgo(artifact.updatedAt)}</Badge>}
              <Badge>
                <Nfc size={12} /> <Mono className="text-[11px]">{artifact.nfcTag}</Mono>
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !dirty && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-good">
              <Check size={14} /> Saved. Handhelds pick it up on next sync
            </span>
          )}
          {isEdited(id) && !dirty && (
            <Button
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                revertArtifact(id)
                setDraft(draftOf(getArtifact(id)!))
                setSavedAt(null)
              }}
            >
              Revert to catalogue
            </Button>
          )}
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(draftOf(artifact))}>
              Discard
            </Button>
          )}
          <Button variant="primary" disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Catalogue entry" subtitle="The guide narrates and answers only from what is written here." />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2">
                <input className={cx(inputCls, 'h-9')} value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Gallery">
                <Select className="w-full" value={draft.gallery} onChange={(e) => set('gallery', e.target.value as GalleryId)}>
                  {GALLERIES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.room} · {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Period">
                <input className={cx(inputCls, 'h-9')} value={draft.period} onChange={(e) => set('period', e.target.value)} />
              </Field>
              <Field label="Region or find-spot">
                <input className={cx(inputCls, 'h-9')} value={draft.region} onChange={(e) => set('region', e.target.value)} />
              </Field>
              <Field label="Material">
                <input className={cx(inputCls, 'h-9')} value={draft.material} onChange={(e) => set('material', e.target.value)} />
              </Field>
              <Field label="Dimensions">
                <input className={cx(inputCls, 'h-9')} value={draft.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
              </Field>
              <Field label="Accession number">
                <input className={cx(inputCls, 'h-9 bg-surface-2 font-mono text-[12.5px] text-ink-2')} value={artifact.accession} readOnly />
              </Field>
              <Field label="Description" hint={`${draft.description.length} characters`} className="sm:col-span-2">
                <textarea
                  className={cx(inputCls, 'min-h-[132px] py-2.5 leading-relaxed')}
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              <Field label="Curator notes" hint="Used for answers, not read aloud" className="sm:col-span-2">
                <textarea
                  className={cx(inputCls, 'min-h-[96px] py-2.5 leading-relaxed')}
                  placeholder="How it came to the museum, restoration history, stories and legends, facts visitors ask for…"
                  value={draft.curatorNotes}
                  onChange={(e) => set('curatorNotes', e.target.value)}
                />
              </Field>
            </div>

            <div className="border-t border-line px-5 py-4">
              <div className="mb-2.5 flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-ink-2">What the guide can answer from this entry</span>
                <span className="text-[11.5px] text-ink-3">
                  {cov.filter((c) => c.covered).length} of {cov.length} topics
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cov.map((c) => (
                  <span
                    key={c.topic}
                    className={cx(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px]',
                      c.covered ? 'border-transparent bg-good-wash text-good' : 'border-dashed border-line-strong text-ink-3',
                    )}
                  >
                    {c.covered ? <Check size={12} strokeWidth={2.4} /> : <CircleDashed size={12} />}
                    {c.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-line px-5 py-4">
              <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">Narration languages</div>
              <div className="flex flex-wrap gap-1.5">
                {LANGS.map((l) => {
                  const on = draft.narrationLangs.includes(l.id)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'narrationLangs',
                          on ? draft.narrationLangs.filter((x) => x !== l.id) : ([...draft.narrationLangs, l.id] as Lang[]),
                        )
                      }
                      className={cx(
                        'h-7 rounded-md border px-2.5 text-[12.5px] transition-colors',
                        on ? 'border-accent/40 bg-accent-wash text-accent-ink' : 'border-line-strong text-ink-3 hover:text-ink',
                      )}
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              <Toggle checked={draft.verified} onChange={(v) => set('verified', v)} label="Verified by a curator" />
              <span className="text-[12px] text-ink-3">Unverified entries are narrated with a short disclaimer.</span>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="How visitors engage" subtitle={range.label} />
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 pb-4 sm:grid-cols-3">
              <Metric label="Visitors" value={fmtInt(stats.visitors)} foot={`${fmtPct(stats.reach)} of all`} />
              <Metric label="Avg dwell" value={stats.taps ? fmtSec(stats.avgDwellSec) : '–'} />
              <Metric label="Heard to the end" value={fmtPct(stats.avgListened)} foot="avg narration played" />
              <Metric label="Skipped" value={fmtPct(stats.skipRate)} bad={stats.skipRate > 0.36} />
              <Metric label="Replayed" value={fmtPct(stats.replayRate)} />
              <Metric label="Tag retries" value={fmtPct(stats.retryRate)} bad={stats.retryRate > 0.15} foot="taps that needed another" />
            </div>
            <div className="flex items-end justify-between gap-4 border-t border-line px-5 py-4">
              <div>
                <div className="text-[12.5px] text-ink-2">Taps per day</div>
                <div className="text-[11.5px] text-ink-3">last 30 open days</div>
              </div>
              <Sparkline values={daily.map((d) => d.taps)} width={220} height={40} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="What visitors ask"
              subtitle={`${fmtInt(questions.length)} questions · ${fmtPct(stats.unansweredRate)} unanswered`}
            />
            {topics.length > 0 && (
              <ul className="space-y-2 px-5 pb-4">
                {topics.map(([topic, t]) => (
                  <li key={topic} className="grid grid-cols-[132px_minmax(0,1fr)_96px] items-center gap-3 text-[12.5px]">
                    <span className="truncate text-ink-2">{TOPICS[topic].label}</span>
                    <Meter value={t.total} max={topics[0][1].total} tone={t.unanswered / t.total > 0.4 ? 'bad' : 'accent'} />
                    <span className="text-right text-ink-3 tnum">
                      {t.total}
                      {t.unanswered > 0 && <span className="text-bad"> · {t.unanswered} missed</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between border-t border-line px-5 py-2.5">
              <span className="text-[12.5px] font-medium text-ink">Recent questions</span>
              <Segmented
                size="sm"
                value={qFilter}
                onChange={setQFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'unanswered', label: 'Unanswered' },
                ]}
              />
            </div>
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto border-t border-line scroll-thin">
              {shown.slice(0, 60).map((q) => (
                <li key={q.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-[13.5px] text-ink">“{q.text}”</div>
                    <StatusBadge status={q.status} />
                  </div>
                  {q.text !== q.textEn && <div className="mt-0.5 text-[12.5px] text-ink-3">{q.textEn}</div>}
                  <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                    <LangTag lang={q.lang} />
                    <VisitorLink id={q.sessionId} />
                    <span>·</span>
                    <span>{fmtDateTime(q.at)}</span>
                  </div>
                </li>
              ))}
              {!shown.length && <Empty title="No questions in this period" />}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

function Metric({ label, value, foot, bad }: { label: string; value: ReactNode; foot?: string; bad?: boolean }) {
  return (
    <div>
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={cx('mt-0.5 text-[20px] font-semibold tracking-[-0.01em]', bad ? 'text-bad' : 'text-ink')}>{value}</div>
      {foot && <div className="text-[11.5px] text-ink-3">{foot}</div>}
    </div>
  )
}
