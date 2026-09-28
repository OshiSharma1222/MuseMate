import { Wifi } from 'lucide-react'
import { useState } from 'react'
import { ChartFrame, Columns, HeatLegend, TrendChart, heatColor, useThemeColors } from '../components/charts'
import { Badge, Card, CardHeader, Meter, Mono, PageHeader, ScrollArea, Select, Stat, cx } from '../components/ui'
import { MUSEUM } from '../data/catalog'
import { dayStart } from '../data/seed'
import {
  attendance,
  dailyDuration,
  durationHistogram,
  durationMin,
  galleryStats,
  modes,
  occupancy,
  queriesOf,
  sessionsIn,
  summary,
  weekHeatmap,
} from '../data/selectors'
import { useVersion } from '../data/store'
import { fmt1, fmtDate, fmtDateShort, fmtHour, fmtInt, fmtMin, fmtPct, fmtSec, fmtTime } from '../lib/format'
import { rangeFor, useRange } from '../lib/range'

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export default function Exhibition() {
  const v = useVersion()
  const { range } = useRange()
  const c = useThemeColors()
  // Daily trends need more than one day, so Today borrows the last week for them.
  const trend = range.key === 'today' ? rangeFor('7d') : range
  const list = sessionsIn(v, range.from, range.to)
  const sum = summary(v, range.from, range.to)
  const done = list.filter((s) => s.endedAt !== null)
  const med = median(done.map((s) => durationMin(s)))

  // Open days in range that had visitors, newest first, for the occupancy picker.
  // Today only counts once the doors have opened.
  const today = dayStart(Date.now())
  const opened = new Date().getHours() >= MUSEUM.opensAt
  const days = [...new Set(sessionsIn(v, trend.from, trend.to).map((s) => dayStart(s.startedAt)))]
    .filter((d) => new Date(d).getDay() !== MUSEUM.closedDay && (d < today || opened))
    .sort((a, b) => b - a)
  const [pickedDay, setPickedDay] = useState<number | null>(null)
  const day = pickedDay !== null && days.includes(pickedDay) ? pickedDay : (days[0] ?? dayStart(Date.now()))
  const occ = occupancy(v, day)
  const peak = occ.reduce((best, p) => (p.inside > best.inside ? p : best), { t: day, inside: 0 })

  const heat = weekHeatmap(v, rangeFor('30d').from, range.to)
  let peakCell = { wd: '', h: 0, value: 0 }
  for (const r of heat.rows) for (const cell of r.cells) if (cell.value > peakCell.value) peakCell = { wd: r.name, h: cell.h, value: cell.value }

  const perDay = attendance(v, { ...trend, bucket: 'day' })
  const avgByDay = dailyDuration(v, trend.from, trend.to)
  const hist = durationHistogram(v, range.from, range.to)
  const histPeak = hist.reduce((bi, b, i) => (b.visitors > hist[bi].visitors ? i : bi), 0)
  const galleries = galleryStats(v, range.from, range.to)
  const avgLatency =
    galleries.reduce((a, g) => a + g.avgLatencyMs * g.queries, 0) / Math.max(1, galleries.reduce((a, g) => a + g.queries, 0))
  const modeRows = modes(v, range.from, range.to).map((m) => {
    const ms = list.filter((s) => s.mode === m.mode)
    return { ...m, qpv: ms.length ? ms.reduce((a, s) => a + queriesOf(s).length, 0) / ms.length : 0 }
  })
  const curious = [...modeRows].sort((a, b) => b.qpv - a.qpv)
  const peakIndex = occ.findIndex((o) => o.t === peak.t)
  const busiestDay = perDay.reduce((bi, b, i) => (b.queries > perDay[bi].queries ? i : bi), 0)
  const lengths = avgByDay.map((d) => d.avgMin)
  const longest = avgByDay.reduce((bi, d, i) => (d.avgMin > avgByDay[bi].avgMin ? i : bi), 0)
  const meanLength = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
  const steady = lengths.length > 1 && Math.max(...lengths) - Math.min(...lengths) < meanLength * 0.15
  const child = modeRows.find((m) => m.mode === 'child')

  return (
    <>
      <PageHeader
        eyebrow={`${MUSEUM.name} · ${range.label}`}
        title="Exhibition"
        description="How the whole exhibition is used: when people come, how long they stay, how far they get, and where the guide slows down."
      />

      <Card className="mb-5">
        <div className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x [&>*]:px-5 [&>*]:py-4">
          <Stat label="Visitors" value={fmtInt(sum.visitors)} foot={<span>{fmtInt(sum.taps)} taps in total</span>} />
          <Stat label="Median visit" value={fmtMin(med)} foot={<span>mean {fmtMin(sum.avgDurationMin)}</span>} />
          <Stat
            label="Busiest slot"
            value={peakCell.value ? `${peakCell.wd} ${fmtHour(peakCell.h)}` : '–'}
            foot={<span>{fmt1(peakCell.value)} arrivals per hour, last 30 days</span>}
          />
          <Stat
            label="Reach the last gallery"
            value={fmtPct(galleries[galleries.length - 1]?.reach ?? 0)}
            foot={<span>{galleries[galleries.length - 1]?.name}</span>}
          />
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title={peak.inside ? `${peak.inside} people were inside at the ${fmtTime(peak.t)} peak` : 'Nobody inside yet'}
          subtitle={`Handhelds out at each quarter hour on ${fmtDate(day)}`}
          right={
            <Select value={day} onChange={(e) => setPickedDay(Number(e.target.value))} aria-label="Day">
              {days.map((d) => (
                <option key={d} value={d}>
                  {fmtDate(d)}
                  {d === today ? ' (today)' : ''}
                </option>
              ))}
            </Select>
          }
        />
        <ChartFrame>
          <TrendChart
            data={occ.map((o) => ({ t: o.t, inside: o.inside }))}
            xKey="t"
            height={250}
            xFormat={(t) => fmtTime(t)}
            series={[{ key: 'inside', name: 'Inside', color: c['series-1'], kind: 'area' }]}
            callout={peak.inside && peakIndex >= 0 ? { index: peakIndex, key: 'inside', text: String(peak.inside) } : undefined}
          />
        </ChartFrame>
      </Card>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={hist[histPeak].visitors ? `Most visits last ${hist[histPeak].lo}–${hist[histPeak].lo + 10} minutes` : 'How long visits last'}
            subtitle="Completed visits in 10-minute bands"
          />
          <ChartFrame>
            <Columns
              data={hist}
              xKey="label"
              yKey="visitors"
              name="Visitors"
              height={220}
              highlight={histPeak}
              xFormat={(l) => String(l)}
              titleFormat={(l) => (l === '120+' ? '2 hours or more' : `${l}–${Number(l) + 10} min`)}
              yFormat={fmtInt}
            />
          </ChartFrame>
        </Card>
        <Card>
          <CardHeader
            title={
              !lengths.length
                ? 'Average visit length'
                : steady
                  ? `Visits hold steady at about ${Math.round(meanLength)} minutes`
                  : `Visits ran longest on ${fmtDate(avgByDay[longest].t)}, ${Math.round(avgByDay[longest].avgMin)} minutes`
            }
            subtitle={range.key === 'today' ? 'Average minutes from pick-up to return, last 7 days' : 'Average minutes from pick-up to return, each day'}
          />
          <ChartFrame>
            <TrendChart
              data={avgByDay.map((d) => ({ t: d.t, avg: Math.round(d.avgMin) }))}
              xKey="t"
              height={220}
              xFormat={fmtDateShort}
              titleFormat={fmtDate}
              valueFormat={(n) => `${n} min`}
              series={[{ key: 'avg', name: 'Average visit', color: c['series-3'], kind: 'line' }]}
            />
          </ChartFrame>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader
            title={perDay[busiestDay]?.queries ? `${fmtDate(perDay[busiestDay].t)} drew the most questions` : 'Questions per day'}
            subtitle={range.key === 'today' ? 'Push-to-talk questions each day, last 7 days' : 'Push-to-talk questions the guide received each day'}
          />
          <ChartFrame>
            <Columns
              data={perDay.map((b) => ({ t: b.t, queries: b.queries }))}
              xKey="t"
              yKey="queries"
              name="Questions"
              height={230}
              xFormat={(t) => fmtDateShort(Number(t))}
              titleFormat={(t) => fmtDate(Number(t))}
              yFormat={fmtInt}
            />
          </ChartFrame>
        </Card>

        <Card>
          <CardHeader
            title={peakCell.value ? `${peakCell.wd} at ${fmtHour(peakCell.h)} is the rush hour` : 'When visitors arrive'}
            subtitle="Average arrivals per hour over the last 30 days" right={<HeatLegend max={heat.max} format={(n) => fmt1(n)} />} />
          <ScrollArea className="px-5 pb-5">
            <div className="min-w-[360px]">
              <div className="grid grid-cols-[40px_repeat(8,minmax(0,1fr))] gap-[3px]">
                <span />
                {heat.hours.map((h) => (
                  <span key={h} className="pb-1 text-center text-[11px] text-ink-3 tnum">
                    {fmtHour(h).slice(0, 2)}
                  </span>
                ))}
                {heat.rows.map((r) => (
                  <div key={r.wd} className="contents">
                    <span className="flex items-center text-[12px] text-ink-2">{r.name}</span>
                    {r.closed ? (
                      <span className="col-span-8 flex h-8 items-center justify-center rounded-[2px] border border-dashed border-line-strong text-[11.5px] text-ink-3">
                        Closed
                      </span>
                    ) : (
                      r.cells.map((cell) => (
                        <span
                          key={cell.h}
                          title={`${r.name} ${fmtHour(cell.h)}–${fmtHour(cell.h + 1)}: ${fmt1(cell.value)} arrivals on average`}
                          className="group relative h-8 rounded-[2px]"
                          style={{ background: heatColor(cell.value, heat.max) }}
                        >
                          <span
                            className={cx(
                              'absolute inset-0 flex items-center justify-center text-[11px] font-medium opacity-0 tnum group-hover:opacity-100',
                              cell.value / heat.max > 0.55 ? 'text-white' : 'text-ink',
                            )}
                          >
                            {fmt1(cell.value)}
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Through the galleries" subtitle="Share of visitors who tapped at least one artifact in each room, in floor-plan order" />
          <ScrollArea>
            <table className="w-full min-w-[500px] text-[13px]">
              <thead>
                <tr className="text-left col-label">
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap pl-5">Gallery</th>
                  <th className="w-[30%] border-y border-line px-3 py-2">Reached</th>
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap text-right">Avg dwell</th>
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap pr-5 text-right">Answer time</th>
                </tr>
              </thead>
              <tbody>
                {galleries.map((g) => {
                  const slow = g.queries > 20 && g.avgLatencyMs > avgLatency * 1.6
                  return (
                    <tr key={g.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2.5 pl-5">
                        <div className="flex items-center gap-2">
                          <Mono className="shrink-0 rounded border border-line px-1 text-[11px] text-ink-2">{g.room}</Mono>
                          <span className="leading-snug text-ink">{g.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Meter value={g.reach} tone={g.reach < 0.5 ? 'warn' : 'accent'} />
                          </div>
                          <span className="w-10 text-right text-ink tnum">{fmtPct(g.reach)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-2 tnum">{fmtSec(g.avgDwellSec)}</td>
                      <td className="px-3 py-2.5 pr-5 text-right tnum">
                        {slow ? (
                          <Badge tone="bad">
                            <Wifi size={11} /> {(g.avgLatencyMs / 1000).toFixed(1)} s
                          </Badge>
                        ) : (
                          <span className="text-ink-2">{g.queries ? `${(g.avgLatencyMs / 1000).toFixed(1)} s` : '–'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollArea>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="By narration mode" subtitle="Chosen at the entry tag; switchable by voice" />
          <ScrollArea>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left col-label">
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap pl-5">Mode</th>
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap text-right">Visitors</th>
                  <th className="border-y border-line px-3 py-2 whitespace-nowrap text-right">Avg visit</th>
                  <th className="border-y border-line px-3 py-2 pr-5 text-right">Questions each</th>
                </tr>
              </thead>
              <tbody>
                {modeRows.map((m, i) => (
                  <tr key={m.mode} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2.5 pl-5">
                      <span className="inline-flex items-center gap-2 text-ink">
                        <span className="size-2.5 rounded-[3px]" style={{ background: c[`series-${i + 1}` as 'series-1'] }} />
                        {m.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tnum">
                      {fmtInt(m.visitors)} <span className="text-ink-3">· {fmtPct(m.share)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-ink-2 tnum">{m.avgMin ? fmtMin(m.avgMin) : '–'}</td>
                    <td className="px-3 py-2.5 pr-5 text-right text-ink-2 tnum">{fmt1(m.qpv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          {curious[0]?.qpv > 0 && (
            <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
              {curious[0].name} mode visitors ask the most, {fmt1(curious[0].qpv)} questions each
              {child && child.mode !== curious[0].mode && child.qpv > curious[curious.length - 1].qpv * 2
                ? `, with child mode close behind at ${fmt1(child.qpv)}. Most child-mode visits are school groups on weekday mornings.`
                : '.'}
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
