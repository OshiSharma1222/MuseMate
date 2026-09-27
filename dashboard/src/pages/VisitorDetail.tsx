import { ArrowLeft, Clock3, Download, MapPin, Nfc, Repeat2, SkipForward } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArtifactGlyph, StatusBadge } from '../components/bits'
import { Badge, Button, Card, CardHeader, Empty, LangTag, Mono, cx } from '../components/ui'
import { GALLERIES, GALLERY_BY_ID, LANGS, MODE_NAME, REVIEW_TAGS, TOPICS } from '../data/catalog'
import { exportQueries, exportVisitors } from '../data/exports'
import { durationMin, queriesOf } from '../data/selectors'
import { getArtifact, getSession, useVersion } from '../data/store'
import type { Query, Stop, Topic } from '../data/types'
import { fmtDate, fmtInt, fmtMin, fmtPct, fmtSec, fmtTime } from '../lib/format'
import NotFound from './NotFound'
import { Stars } from './Visitors'

type Item = { kind: 'stop'; at: number; stop: Stop } | { kind: 'loose'; at: number; query: Query }

function QuestionBubble({ q }: { q: Query }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13.5px] text-ink">“{q.text}”</span>
        <StatusBadge status={q.status} />
      </div>
      {q.text !== q.textEn && <div className="mt-0.5 text-[12.5px] text-ink-3">{q.textEn}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
        <span className="tnum">{fmtTime(q.at)}</span>
        <span>·</span>
        <span>{TOPICS[q.topic].label}</span>
        <span>·</span>
        <span className={cx('tnum', q.latencyMs > 5000 && 'text-bad')}>
          {q.status === 'answered' ? 'answered' : 'replied'} in {(q.latencyMs / 1000).toFixed(1)} s
        </span>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-[14px] font-medium text-ink">{children}</div>
    </div>
  )
}

export default function VisitorDetail() {
  const { id = '' } = useParams()
  useVersion()
  const s = getSession(id)
  if (!s) return <NotFound />

  const qs = queriesOf(s)
  const unanswered = qs.filter((q) => q.status === 'unanswered').length
  const lang = LANGS.find((l) => l.id === s.lang)!
  const items: Item[] = [
    ...s.stops.map((stop) => ({ kind: 'stop' as const, at: stop.at, stop })),
    ...s.looseQueries.map((query) => ({ kind: 'loose' as const, at: query.at, query })),
  ].sort((a, b) => a.at - b.at)

  const visitedGalleries = new Map<string, number>()
  for (const st of s.stops) {
    const g = getArtifact(st.artifactId)?.gallery
    if (g) visitedGalleries.set(g, (visitedGalleries.get(g) ?? 0) + 1)
  }
  const topicCount = new Map<Topic, number>()
  for (const q of qs) topicCount.set(q.topic, (topicCount.get(q.topic) ?? 0) + 1)
  const interests = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  let lastGallery: string | null = null

  return (
    <>
      <Link to="/visitors" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft size={15} /> Visitors
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">
            Visit · {s.deviceId} · {fmtDate(s.startedAt)}
          </div>
          <h1 className="font-serif text-[40px] leading-none text-ink">{s.id}</h1>
        </div>
        <div className="flex gap-2">
          <Button icon={<Download size={15} />} onClick={() => exportVisitors([s], s.id)}>
            Visit CSV
          </Button>
          <Button icon={<Download size={15} />} onClick={() => exportQueries([s], s.id)} disabled={!qs.length}>
            Questions CSV
          </Button>
        </div>
      </div>

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4 xl:grid-cols-8">
          <Fact label="Picked up">{fmtTime(s.startedAt)}</Fact>
          <Fact label="Returned">
            {s.endedAt ? (
              fmtTime(s.endedAt)
            ) : (
              <span className="inline-flex items-center gap-1.5 text-good">
                <span className="relative size-1.5 rounded-full bg-good text-good live-dot" /> Still inside
              </span>
            )}
          </Fact>
          <Fact label="Time inside">{fmtMin(durationMin(s))}</Fact>
          <Fact label="Language">
            {lang.name} <span className="font-normal text-ink-3">{lang.native !== lang.name && lang.native}</span>
          </Fact>
          <Fact label="Mode">{MODE_NAME[s.mode]}</Fact>
          <Fact label="Artifacts">{s.stops.length}</Fact>
          <Fact label="Questions">
            {qs.length}
            {unanswered > 0 && <span className="font-normal text-bad"> · {unanswered} no answer</span>}
          </Fact>
          <Fact label="Rating">
            <Stars rating={s.rating} />
          </Fact>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Route through the museum" subtitle="Every tap and question, in order" />
          {items.length === 0 ? (
            <Empty icon={<Nfc size={22} />} title="No taps yet">
              The visitor has picked up a handheld but not tapped an artifact.
            </Empty>
          ) : (
            <ol className="px-5 pb-6">
              {items.map((it, i) => {
                if (it.kind === 'loose') {
                  return (
                    <li key={it.query.id} className="relative grid grid-cols-[52px_20px_minmax(0,1fr)] gap-x-3 pb-5">
                      <span className="pt-1 text-right text-[12px] text-ink-3 tnum">{fmtTime(it.at)}</span>
                      <Rail last={i === items.length - 1} dot="hollow" />
                      <div>
                        <div className="mb-1.5 text-[12.5px] text-ink-3">Asked between galleries</div>
                        <QuestionBubble q={it.query} />
                      </div>
                    </li>
                  )
                }
                const st = it.stop
                const art = getArtifact(st.artifactId)
                const gallery = art ? GALLERY_BY_ID[art.gallery] : null
                const newGallery = gallery && gallery.id !== lastGallery
                lastGallery = gallery?.id ?? lastGallery
                return (
                  <li key={`${st.artifactId}-${st.at}`}>
                    {newGallery && (
                      <div className="grid grid-cols-[52px_20px_minmax(0,1fr)] gap-x-3 pt-1 pb-3">
                        <span />
                        <Rail last={false} dot="none" />
                        <div className="eyebrow flex items-center gap-1.5">
                          <MapPin size={12} /> {gallery.room} · {gallery.name}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-[52px_20px_minmax(0,1fr)] gap-x-3 pb-5">
                      <span className="pt-2 text-right text-[12px] text-ink-3 tnum">{fmtTime(st.at)}</span>
                      <Rail last={i === items.length - 1} dot={st.skipped ? 'hollow' : 'solid'} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link to={`/artifacts/${st.artifactId}`} className="group flex min-w-0 items-center gap-2.5">
                            {art && <ArtifactGlyph kind={art.kind} size={30} />}
                            <span className="truncate font-medium text-ink group-hover:text-accent">{art?.name ?? st.artifactId}</span>
                          </Link>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {st.tapRetries > 0 && (
                              <Badge tone="warn">
                                <Nfc size={11} /> {st.tapRetries + 1} taps to read
                              </Badge>
                            )}
                            {st.skipped && (
                              <Badge tone="bad">
                                <SkipForward size={11} /> Skipped
                              </Badge>
                            )}
                            {st.replays > 0 && (
                              <Badge tone="accent">
                                <Repeat2 size={11} /> Replayed{st.replays > 1 ? ` ×${st.replays}` : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-3">
                          <span className="inline-flex items-center gap-1 tnum">
                            <Clock3 size={12} /> {fmtSec(st.dwellSec)}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                              <span
                                className={cx('block h-full rounded-full', st.skipped ? 'bg-bad' : 'bg-s1')}
                                style={{ width: `${st.listenedPct * 100}%` }}
                              />
                            </span>
                            <span className="tnum">{fmtPct(st.listenedPct)} of narration</span>
                          </span>
                        </div>
                        {st.queries.length > 0 && (
                          <div className="mt-2.5 space-y-2">
                            {st.queries.map((q) => (
                              <QuestionBubble key={q.id} q={q} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
              {s.endedAt && (
                <li className="grid grid-cols-[52px_20px_minmax(0,1fr)] gap-x-3">
                  <span className="text-right text-[12px] text-ink-3 tnum">{fmtTime(s.endedAt)}</span>
                  <Rail last dot="end" />
                  <span className="text-[12.5px] text-ink-3">Returned {s.deviceId} at the counter</span>
                </li>
              )}
            </ol>
          )}
        </Card>

        <div className="space-y-5">
          {s.review && (
            <Card>
              <CardHeader title="What they said" right={<Stars rating={s.review.rating} />} />
              <blockquote className="px-5 pb-2 font-serif text-[21px] leading-snug text-ink italic">“{s.review.text}”</blockquote>
              {s.review.text !== s.review.textEn && <p className="px-5 pb-2 text-[12.5px] text-ink-3">{s.review.textEn}</p>}
              <div className="flex flex-wrap gap-1.5 px-5 pt-1 pb-4">
                {s.review.tags.map((t) => (
                  <Badge key={t} tone={REVIEW_TAGS[t].positive ? 'good' : 'bad'}>
                    {REVIEW_TAGS[t].label}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Galleries reached" />
            <ul className="px-5 pb-4">
              {GALLERIES.map((g) => {
                const n = visitedGalleries.get(g.id) ?? 0
                return (
                  <li key={g.id} className="flex items-center gap-3 py-1.5 text-[13px]">
                    <Mono
                      className={cx(
                        'inline-flex h-5 w-7 items-center justify-center rounded border text-[10.5px]',
                        n ? 'border-transparent bg-accent-wash text-accent-ink' : 'border-dashed border-line-strong text-ink-3',
                      )}
                    >
                      {g.room}
                    </Mono>
                    <span className={cx('flex-1 truncate', n ? 'text-ink' : 'text-ink-3')}>{g.name}</span>
                    <span className="text-[12px] text-ink-3 tnum">{n ? `${n} tapped` : 'not reached'}</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Interests" subtitle="What their questions were about" />
            {interests.length ? (
              <ul className="space-y-1.5 px-5 pb-4">
                {interests.map(([t, n]) => (
                  <li key={t} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-2">{TOPICS[t].label}</span>
                    <span className="text-ink-3 tnum">{fmtInt(n)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-4 text-[13px] text-ink-3">No questions asked. Narration only.</p>
            )}
            <div className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
              The handheld uses these to pick what to say next. <LangTag lang={s.lang} /> narration throughout.
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function Rail({ last, dot }: { last: boolean; dot: 'solid' | 'hollow' | 'none' | 'end' }) {
  return (
    <span className="relative flex justify-center">
      <span className={cx('absolute top-0 w-px bg-line-strong', last ? 'h-3' : 'bottom-0')} />
      {dot === 'solid' && <span className="relative mt-2.5 size-2.5 rounded-full bg-s1 ring-4 ring-surface" />}
      {dot === 'hollow' && <span className="relative mt-2.5 size-2.5 rounded-full border-2 border-line-strong bg-surface ring-4 ring-surface" />}
      {dot === 'end' && <span className="relative mt-1 size-2.5 rounded-sm bg-ink-3 ring-4 ring-surface" />}
    </span>
  )
}
