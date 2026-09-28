import { ArrowRight, Radio } from 'lucide-react'
import { Link } from 'react-router'
import { ArtifactLink, LiveFeed } from '../components/bits'
import { ChartFrame, Columns, LegendKey, TrendChart, useThemeColors } from '../components/charts'
import { CountUp, HeroBanner } from '../components/scenery'
import { Badge, Card, CardHeader, Delta, Empty, Meter, Stat, cx } from '../components/ui'
import { MUSEUM } from '../data/catalog'
import {
  artifactStats,
  attendance,
  languages,
  modes,
  painPoints,
  queriesPerVisitorDist,
  summary,
} from '../data/selectors'
import { getActiveCount, getResolved, isLive, useVersion } from '../data/store'
import { change, fmt1, fmtDate, fmtDateShort, fmtHour, fmtInt, fmtMin, fmtPct } from '../lib/format'
import { useRange } from '../lib/range'

const SEVERITY_TONE = { high: 'bad', medium: 'warn', low: 'neutral' } as const

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Handhelds out on the floor right now, over the hero photo. */
function FloorNow() {
  const inside = Math.min(MUSEUM.devices, getActiveCount())
  const live = isLive()
  return (
    <div className="min-w-[200px] rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-md">
      <div className="flex items-center gap-2 text-[12px] font-medium text-white/75">
        <span className={cx('relative size-2 rounded-full', live ? 'live-dot bg-[#5fd873] text-[#5fd873]' : 'bg-white/40')} />
        {live ? 'On the floor now' : 'Live feed paused'}
      </div>
      <div className="mt-2 text-[40px] leading-none font-semibold tracking-[-0.02em] tnum">
        <CountUp text={String(inside)} />
      </div>
      <div className="mt-1.5 text-[12px] text-white/65">
        of {MUSEUM.devices} handhelds out · open {MUSEUM.opensAt}:00–{MUSEUM.closesAt}:00
      </div>
    </div>
  )
}

export default function Overview() {
  const v = useVersion()
  const { range } = useRange()
  const c = useThemeColors()
  const cur = summary(v, range.from, range.to)
  const prev = summary(v, range.prevFrom, range.prevTo)
  const buckets = attendance(v, range)
  const langs = languages(v, range.from, range.to).filter((l) => l.visitors > 0)
  const modeRows = modes(v, range.from, range.to)
  const stats = [...artifactStats(v, range.from, range.to).values()]
  const topAsked = [...stats].sort((a, b) => b.queries - a.queries).slice(0, 6)
  const mostSkipped = stats.filter((s) => s.taps >= 10).sort((a, b) => b.skipRate - a.skipRate).slice(0, 4)
  const qpv = queriesPerVisitorDist(v, range.from, range.to)
  const resolved = getResolved()
  const issues = painPoints(v, range.from, range.to).filter((i) => !resolved[i.key]).slice(0, 3)
  const hourly = range.bucket === 'hour'
  const peak = buckets.reduce((bi, b, i) => (b.visitors > buckets[bi].visitors ? i : bi), 0)
  const peakAt = buckets[peak]
  const topQpv = qpv.reduce((bi, b, i) => (b.visitors > qpv[bi].visitors ? i : bi), 0)
  const cap = (t: string) => t.replace(/^./, (m) => m.toUpperCase())
  const empty = cur.visitors === 0
  const closedToday = range.key === 'today' && new Date().getDay() === MUSEUM.closedDay

  return (
    <>
      <HeroBanner
        eyebrow={`Overview · ${MUSEUM.name} · ${range.label}`}
        title={greeting()}
        aside={<FloorNow />}
        description={
          empty ? (
            closedToday ? (
              'The museum is closed on Mondays. Switch to 7 or 30 days to see the week, or watch the live demo feed.'
            ) : (
              'No visitors yet in this period.'
            )
          ) : (
            <>
              {fmtInt(cur.visitors)} {cur.visitors === 1 ? 'visitor' : 'visitors'} tapped artifacts {fmtInt(cur.taps)} times
              {cur.queries ? (
                <>
                  {' '}
                  and asked {fmtInt(cur.queries)} questions in {langs.length} languages. The guide answered{' '}
                  {fmtPct(1 - cur.unansweredRate)} of them.
                </>
              ) : (
                <>, listening in {langs.length} languages. No questions yet.</>
              )}
            </>
          )
        }
      />

      <Card className="mb-5">
        <div className="grid grid-cols-2 divide-line md:grid-cols-3 xl:grid-cols-5 xl:divide-x [&>*]:px-5 [&>*]:py-4">
          <Stat
            label="Visitors"
            value={fmtInt(cur.visitors)}
            delta={<Delta value={change(cur.visitors, prev.visitors)} suffix={`vs ${range.prevLabel}`} />}
          />
          <Stat
            label="Average visit"
            value={cur.avgDurationMin ? fmtMin(cur.avgDurationMin) : '–'}
            delta={<Delta value={change(cur.avgDurationMin, prev.avgDurationMin)} />}
            foot={<span>{fmt1(cur.artifactsPerVisitor)} artifacts each</span>}
          />
          <Stat
            label="Questions asked"
            value={fmtInt(cur.queries)}
            delta={<Delta value={change(cur.queries, prev.queries)} />}
          />
          <Stat
            label="Questions per visitor"
            value={fmt1(cur.queriesPerVisitor)}
            delta={<Delta value={change(cur.queriesPerVisitor, prev.queriesPerVisitor)} />}
          />
          <Stat
            label="Went unanswered"
            value={fmtPct(cur.unansweredRate, 1)}
            delta={<Delta value={change(cur.unansweredRate, prev.unansweredRate)} goodWhen="down" />}
            foot={<span>{fmtInt(cur.unanswered)} questions</span>}
          />
        </div>
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title={
              !peakAt?.visitors
                ? 'No arrivals yet'
                : hourly
                  ? `${fmtHour(new Date(peakAt.t).getHours())} has been the busiest hour, with ${fmtInt(peakAt.visitors)} arrivals`
                  : `${range.key === '7d' ? WEEKDAYS[new Date(peakAt.t).getDay()] : fmtDate(peakAt.t)} brought the most visitors: ${fmtInt(peakAt.visitors)}`
            }
            subtitle={
              hourly
                ? `Handhelds picked up each hour, against the ${range.prevLabel}`
                : `Handhelds picked up each day against the ${range.prevLabel}. Closed on Mondays.`
            }
          />
          <ChartFrame>
            {empty && !buckets.some((b) => b.prevVisitors) ? (
              <Empty title="No arrivals in this period" />
            ) : (
              <TrendChart
                data={buckets.map((b) => ({ t: b.t, visitors: b.visitors, prev: b.prevVisitors }))}
                xKey="t"
                height={268}
                xFormat={(t) => (hourly ? fmtHour(new Date(t).getHours()) : fmtDateShort(t))}
                titleFormat={(t) => (hourly ? `${fmtHour(new Date(t).getHours())}–${fmtHour(new Date(t).getHours() + 1)}` : fmtDate(t))}
                series={[
                  { key: 'prev', name: cap(range.prevLabel), color: c['ink-3'], kind: 'line', faint: true, endLabel: () => cap(range.prevLabel) },
                  { key: 'visitors', name: 'Visitors', color: c['series-1'], kind: 'area', endLabel: () => range.label },
                ]}
                callout={
                  peakAt?.visitors && peak !== buckets.length - 1 ? { index: peak, key: 'visitors', text: fmtInt(peakAt.visitors) } : undefined
                }
              />
            )}
          </ChartFrame>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Radio size={15} className={isLive() ? 'text-good' : 'text-ink-3'} />
                Live on the floor
              </span>
            }
            subtitle={isLive() ? 'Taps and questions as they happen' : 'Paused'}
          />
          <div className="relative -mt-1 max-h-[300px] flex-1 overflow-hidden border-t border-line">
            <LiveFeed limit={10} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />
          </div>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Most asked-about artifacts"
            subtitle="Questions visitors asked while standing at each piece"
            right={
              <Link to="/artifacts" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                All artifacts <ArrowRight size={13} />
              </Link>
            }
          />
          <div className="grid grid-cols-[20px_minmax(0,1fr)_120px_84px] gap-3 border-t border-line px-5 py-2 col-label max-sm:grid-cols-[20px_minmax(0,1fr)_84px]">
            <span>#</span>
            <span>Artifact</span>
            <span className="max-sm:hidden">Questions</span>
            <span className="text-right">Unanswered</span>
          </div>
          <ol className="border-t border-line">
            {topAsked.map((s, i) => (
              <li key={s.id} className="grid grid-cols-[20px_minmax(0,1fr)_120px_84px] items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0 max-sm:grid-cols-[20px_minmax(0,1fr)_84px]">
                <span className="text-[12px] text-ink-3 tnum">{i + 1}</span>
                <ArtifactLink id={s.id} />
                <div className="max-sm:hidden">
                  <div className="mb-1 flex justify-between text-[12px] tnum">
                    <span className="font-medium text-ink">{fmtInt(s.queries)}</span>
                    <span className="text-ink-3">{fmtInt(s.visitors)} visitors</span>
                  </div>
                  <Meter value={s.queries} max={topAsked[0]?.queries || 1} />
                </div>
                <div className="text-right">
                  {s.unansweredRate > 0.3 ? (
                    <Badge tone="bad">{fmtPct(s.unansweredRate)}</Badge>
                  ) : (
                    <span className="text-[12.5px] text-ink-2 tnum">{fmtPct(s.unansweredRate)}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Languages" subtitle="Narration language chosen at the entry tag" />
          <ul className="space-y-2.5 px-5 pb-5">
            {langs.slice(0, 8).map((l) => (
              <li key={l.lang} className="grid grid-cols-[112px_minmax(0,1fr)_64px] items-center gap-3 text-[13px]">
                <span className="truncate">
                  <span className="text-ink">{l.name}</span>{' '}
                  <span className="text-[12px] text-ink-3">{l.native !== l.name ? l.native : ''}</span>
                </span>
                <Meter value={l.visitors} max={langs[0].visitors} />
                <span className="text-right text-ink-2 tnum">{fmtPct(l.share, l.share < 0.1 ? 1 : 0)}</span>
              </li>
            ))}
            {langs.length > 8 && (
              <li className="text-[12px] text-ink-3">
                + {langs.length - 8} more: {langs.slice(8).map((l) => l.name).join(', ')}
              </li>
            )}
          </ul>
          <div className="border-t border-line px-5 py-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">Narration mode</span>
              <span className="text-[12px] text-ink-3">share of visitors</span>
            </div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-[1px]">
              {modeRows.map((m, i) =>
                m.share > 0 ? (
                  <span key={m.mode} style={{ width: `${m.share * 100}%`, background: c[`series-${i + 1}` as 'series-1'] }} />
                ) : null,
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {modeRows.map((m, i) => (
                <div key={m.mode} className="flex items-center justify-between text-[12.5px]">
                  <LegendKey kind="swatch" color={c[`series-${i + 1}` as 'series-1']} label={m.name} />
                  <span className="text-ink-2 tnum">{fmtPct(m.share)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title={qpv[topQpv].visitors ? `Most visitors ask ${qpv[topQpv].label === '0' ? 'nothing' : `${qpv[topQpv].label} questions`}` : 'Questions per visitor'}
            subtitle="Visitors by how many questions they asked"
          />
          <ChartFrame>
            <Columns
              data={qpv}
              xKey="label"
              yKey="visitors"
              name="Visitors"
              height={196}
              titleFormat={(l) => `${l} questions`}
              yFormat={fmtInt}
            />
          </ChartFrame>
        </Card>

        <Card>
          <CardHeader
            title="Needs attention"
            subtitle="Top open pain points"
            right={
              <Link to="/pain-points" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                All <ArrowRight size={13} />
              </Link>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {issues.map((i) => (
              <li key={i.key}>
                <Link to={`/pain-points#${encodeURIComponent(i.key)}`} className="block px-5 py-3 hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[13px] leading-snug font-medium text-ink">{i.title}</span>
                    <Badge tone={SEVERITY_TONE[i.severity]} className="capitalize">
                      {i.severity}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    {i.metric} · {fmtInt(i.affected)} {i.affectedLabel}
                  </div>
                </Link>
              </li>
            ))}
            {!issues.length && <Empty title="Nothing open">Every pain point in this period is marked handled.</Empty>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Most skipped" subtitle="Narrations stopped before half-way" />
          <ul className="space-y-3 px-5 pb-5">
            {mostSkipped.map((s) => (
              <li key={s.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <ArtifactLink id={s.id} showGallery={false} />
                  </div>
                  <span className={cx('shrink-0 text-[13px] font-medium tnum', s.skipRate > 0.36 ? 'text-bad' : 'text-ink')}>
                    {fmtPct(s.skipRate)}
                  </span>
                </div>
                <Meter value={s.skipRate} tone={s.skipRate > 0.36 ? 'bad' : 'muted'} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
