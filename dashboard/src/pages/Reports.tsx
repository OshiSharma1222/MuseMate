import { Download, FileSpreadsheet, Landmark, Printer, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, Card, Delta, PageHeader } from '../components/ui'
import { GALLERY_BY_ID, MUSEUM } from '../data/catalog'
import { exportArtifacts, exportQueries, exportVisitors, sessionsForExport } from '../data/exports'
import { artifactStats, attendance, languages, painPoints, queriesOf, reviewStats, summary } from '../data/selectors'
import { getArtifact, getResolved, useVersion } from '../data/store'
import { change, fmt1, fmtDate, fmtDateShort, fmtInt, fmtMin, fmtPct, fmtSec } from '../lib/format'
import { useRange } from '../lib/range'

function ExportCard({
  icon,
  title,
  rows,
  detail,
  onClick,
}: {
  icon: ReactNode
  title: string
  rows: string
  detail: string
  onClick: () => void
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-surface-3 text-ink-2">{icon}</div>
      <div className="font-serif text-[22px] leading-tight text-ink">{title}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-3">{rows}</div>
      <p className="mt-2 flex-1 text-[13px] text-ink-2">{detail}</p>
      <Button className="mt-4 self-start" icon={<Download size={15} />} onClick={onClick}>
        Download CSV
      </Button>
    </Card>
  )
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-9 mb-3 border-b border-line pb-2 font-serif text-[24px] leading-tight text-ink">{children}</h3>
}

export default function Reports() {
  const v = useVersion()
  const { range } = useRange()
  const list = sessionsForExport(v, range.from, range.to)
  const qCount = list.reduce((a, s) => a + queriesOf(s).length, 0)
  const cur = summary(v, range.from, range.to)
  const prev = summary(v, range.prevFrom, range.prevTo)
  const stats = [...artifactStats(v, range.from, range.to).values()]
  const top = [...stats].sort((a, b) => b.visitors - a.visitors).slice(0, 8)
  const langs = languages(v, range.from, range.to).filter((l) => l.visitors > 0)
  const rv = reviewStats(v, range.from, range.to)
  const resolved = getResolved()
  const issues = painPoints(v, range.from, range.to).filter((i) => !resolved[i.key]).slice(0, 5)
  const days = attendance(v, { ...range, bucket: 'day' })
  const busiest = days.reduce((b, d) => (d.visitors > (b?.visitors ?? -1) ? d : b), days[0])
  const mostAsked = [...stats].sort((a, b) => b.queries - a.queries)[0]
  const bestLang = langs.filter((l) => l.rated >= 5).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0]
  const worstLang = langs.filter((l) => l.rated >= 5).sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0))[0]
  const name = (id: string) => getArtifact(id)?.name ?? id

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Act on it"
          title="Reports"
          description="Take the numbers out of the dashboard: spreadsheets for analysis, and a report to print or save as PDF for the museum director."
        />

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <ExportCard
            icon={<Users size={18} />}
            title="Visitors"
            rows={`${fmtInt(list.length)} visits · ${range.label.toLowerCase()}`}
            detail="One row per visit: device, language, mode, times, artifacts tapped, questions, unanswered count, rating and comment."
            onClick={() => exportVisitors(list, range.key)}
          />
          <ExportCard
            icon={<FileSpreadsheet size={18} />}
            title="Questions"
            rows={`${fmtInt(qCount)} questions · ${range.label.toLowerCase()}`}
            detail="Every question with the visit ID, artifact, the visitor's original script and English, topic, answer status and answer time."
            onClick={() => exportQueries(list, range.key)}
          />
          <ExportCard
            icon={<Landmark size={18} />}
            title="Artifacts"
            rows={`${fmtInt(stats.length)} artifacts · ${range.label.toLowerCase()}`}
            detail="One row per artifact: visitors, taps, dwell, skip, replay and tag-retry rates, questions and unanswered rate."
            onClick={() => exportArtifacts(v, range.from, range.to, range.key)}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-[22px] leading-tight text-ink">Exhibition report</h2>
            <p className="text-[13px] text-ink-3">
              Generated from the edge server for {range.label.toLowerCase()}. Pick the period in the top bar.
            </p>
          </div>
          <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-[860px] rounded-xl border border-line bg-surface px-8 py-10 shadow-card sm:px-14 print:max-w-none print:border-0 print:bg-white print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div>
            <div className="eyebrow">{MUSEUM.name}</div>
            <h1 className="mt-2 font-serif text-[40px] leading-none text-ink">Visitor report</h1>
            <p className="mt-2 text-[14px] text-ink-2">
              {fmtDate(range.from)} to {fmtDate(range.to)} · compared with the {range.prevLabel}
            </p>
          </div>
          <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden className="shrink-0">
            <rect width="32" height="32" rx="8" className="fill-ink" />
            <path d="M9 23V11l7 7 7-7v12" fill="none" className="stroke-surface" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          {[
            { label: 'Visitors', value: fmtInt(cur.visitors), d: change(cur.visitors, prev.visitors), good: 'up' as const },
            { label: 'Average visit', value: fmtMin(cur.avgDurationMin), d: change(cur.avgDurationMin, prev.avgDurationMin), good: 'up' as const },
            { label: 'Questions asked', value: fmtInt(cur.queries), d: change(cur.queries, prev.queries), good: 'up' as const },
            { label: 'Unanswered', value: fmtPct(cur.unansweredRate, 1), d: change(cur.unansweredRate, prev.unansweredRate), good: 'down' as const },
          ].map((k) => (
            <div key={k.label}>
              <div className="text-[12.5px] text-ink-3">{k.label}</div>
              <div className="mt-1 font-serif text-[32px] leading-none text-ink tnum">{k.value}</div>
              <div className="mt-1.5">
                <Delta value={k.d} goodWhen={k.good} />
              </div>
            </div>
          ))}
        </div>

        <H>In brief</H>
        <div className="space-y-2.5 text-[14.5px] leading-relaxed text-ink">
          <p>
            {fmtInt(cur.visitors)} visitors took a handheld, tapping {fmt1(cur.artifactsPerVisitor)} artifacts and asking{' '}
            {fmt1(cur.queriesPerVisitor)} questions each on average.
            {busiest && busiest.visitors > 0 && (
              <>
                {' '}
                The busiest day was {fmtDate(busiest.t)} with {fmtInt(busiest.visitors)} visitors.
              </>
            )}
          </p>
          {mostAsked && top[0] && (
            <p>
              <strong className="font-semibold">{name(mostAsked.id)}</strong> drew the most questions ({fmtInt(mostAsked.queries)})
              {mostAsked.id === top[0].id ? (
                <> and reached the most visitors, {fmtPct(top[0].reach)} of them.</>
              ) : (
                <>
                  , and <strong className="font-semibold">{name(top[0].id)}</strong> reached the most visitors ({fmtPct(top[0].reach)} of
                  them).
                </>
              )}
            </p>
          )}
          {rv.avg !== null && (
            <p>
              Visitors rated the guide {fmt1(rv.avg)} out of 5 across {fmtInt(rv.rated)} ratings.
              {bestLang && worstLang && bestLang.lang !== worstLang.lang && (
                <>
                  {' '}
                  {bestLang.name} narration rated highest ({fmt1(bestLang.avgRating!)}) and {worstLang.name} lowest (
                  {fmt1(worstLang.avgRating!)}).
                </>
              )}
            </p>
          )}
        </div>

        <H>What to fix next</H>
        <ol className="space-y-3.5">
          {issues.map((i, n) => (
            <li key={i.key} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-[14px] break-inside-avoid">
              <span className="font-serif text-[18px] leading-none text-ink-3">{n + 1}</span>
              <div>
                <div className="font-semibold text-ink">
                  {i.title} <span className="font-normal text-ink-3">· {i.metric}</span>
                </div>
                <div className="text-ink-2">{i.action}.</div>
              </div>
            </li>
          ))}
          {!issues.length && <li className="text-[14px] text-ink-2">No open issues for this period.</li>}
        </ol>

        <H>Most visited artifacts</H>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left col-label">
              <th className="pb-2">Artifact</th>
              <th className="pb-2 text-right">Visitors</th>
              <th className="pb-2 text-right">Questions</th>
              <th className="pb-2 text-right">Dwell</th>
              <th className="pb-2 text-right">Skipped</th>
            </tr>
          </thead>
          <tbody>
            {top.map((s) => {
              const a = getArtifact(s.id)
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2">
                    <span className="text-ink">{a?.name}</span>{' '}
                    <span className="text-ink-3">· {a && GALLERY_BY_ID[a.gallery].room}</span>
                  </td>
                  <td className="py-2 text-right tnum">{fmtInt(s.visitors)}</td>
                  <td className="py-2 text-right tnum">{fmtInt(s.queries)}</td>
                  <td className="py-2 text-right tnum">{fmtSec(s.avgDwellSec)}</td>
                  <td className="py-2 text-right tnum">{fmtPct(s.skipRate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <H>Languages</H>
        <p className="text-[14px] leading-relaxed text-ink">
          {langs
            .slice(0, 6)
            .map((l) => `${l.name} ${fmtPct(l.share)}`)
            .join(' · ')}
          {langs.length > 6 && ` · ${langs.length - 6} others`}
        </p>

        <footer className="mt-10 border-t border-line pt-4 text-[11.5px] text-ink-3">
          Generated by MuseMate on {fmtDateShort(Date.now())} from the museum's edge server. Visits are identified by
          handheld session, never by name.
        </footer>
      </article>
    </>
  )
}
