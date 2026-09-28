import { Download, FileSpreadsheet, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { SortTh, useSort } from '../components/table'
import { Badge, Button, Card, Empty, LangTag, Mono, PageHeader, ScrollX, SearchInput, Select, Td, Toggle, cx } from '../components/ui'
import { LANGS, LANG_NAME, MODES, MODE_NAME } from '../data/catalog'
import { exportQueries, exportVisitors } from '../data/exports'
import { durationMin, queriesOf, sessionsIn } from '../data/selectors'
import type { Lang, Mode, Session } from '../data/types'
import { useVersion } from '../data/store'
import { fmtDate, fmtInt, fmtMin, fmtTime } from '../lib/format'
import { useRange } from '../lib/range'

type SortKey = 'started' | 'duration' | 'artifacts' | 'questions' | 'unanswered' | 'rating'

const PAGE = 60

const GROUP_LABEL: Record<Session['group'], string> = {
  solo: 'Individual',
  family: 'Family',
  school: 'School group',
  tour: 'Tour group',
}

export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-ink-3">–</span>
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          strokeWidth={0}
          className={i <= rating ? (rating <= 2 ? 'fill-bad' : 'fill-s4') : 'fill-surface-3'}
        />
      ))}
    </span>
  )
}

export default function Visitors() {
  const v = useVersion()
  const { range } = useRange()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [lang, setLang] = useState<Lang | 'all'>('all')
  const [mode, setMode] = useState<Mode | 'all'>('all')
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const sort = useSort<SortKey>('started')

  const all = sessionsIn(v, range.from, range.to)
  const inside = all.filter((s) => s.endedAt === null).length

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = all.filter(
      (s) =>
        (lang === 'all' || s.lang === lang) &&
        (mode === 'all' || s.mode === mode) &&
        (!onlyGaps || queriesOf(s).some((x) => x.status === 'unanswered')) &&
        (!needle || s.id.toLowerCase().includes(needle) || s.deviceId.toLowerCase().includes(needle)),
    )
    return sort.sort(filtered, (s, k) => {
      switch (k) {
        case 'started':
          return s.startedAt
        case 'duration':
          return durationMin(s)
        case 'artifacts':
          return s.stops.length
        case 'questions':
          return queriesOf(s).length
        case 'unanswered':
          return queriesOf(s).filter((x) => x.status === 'unanswered').length
        case 'rating':
          return s.rating ?? -1
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, lang, mode, onlyGaps, sort.key, sort.dir])

  const label = range.key

  return (
    <>
      <PageHeader
        eyebrow="Visitors"
        title="Visitors"
        description={
          <>
            Each visit is one handheld from pick-up to return, identified by a visit ID rather than a name.{' '}
            {fmtInt(all.length)} visits in {range.label.toLowerCase()}
            {inside > 0 && <>, {inside} still inside</>}.
          </>
        }
        actions={
          <>
            <Button icon={<FileSpreadsheet size={15} />} onClick={() => exportQueries(rows, label)}>
              Questions CSV
            </Button>
            <Button variant="primary" icon={<Download size={15} />} onClick={() => exportVisitors(rows, label)}>
              Export visitors
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Visit ID or device, e.g. MM-07"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
          className="w-full sm:w-64"
        />
        <Select value={lang} onChange={(e) => setLang(e.target.value as Lang | 'all')} aria-label="Language">
          <option value="all">All languages</option>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select value={mode} onChange={(e) => setMode(e.target.value as Mode | 'all')} aria-label="Mode">
          <option value="all">All modes</option>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <div className="px-1">
          <Toggle checked={onlyGaps} onChange={setOnlyGaps} label="Had an unanswered question" />
        </div>
        <span className="ml-auto text-[12.5px] text-ink-3 tnum">
          {fmtInt(rows.length)} {rows.length === 1 ? 'visit' : 'visits'} · exports use these filters
        </span>
      </div>

      <Card className="overflow-hidden">
        <ScrollX>
          <table className="w-full min-w-[800px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="sticky top-0 border-b border-line bg-surface px-3 pl-5 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                  Visit
                </th>
                <SortTh k="started" sort={sort}>
                  Started
                </SortTh>
                <SortTh k="duration" sort={sort} align="right">
                  Time inside
                </SortTh>
                <th className="sticky top-0 border-b border-line bg-surface px-3 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                  Language · mode
                </th>
                <SortTh k="artifacts" sort={sort} align="right">
                  Artifacts
                </SortTh>
                <SortTh k="questions" sort={sort} align="right">
                  Questions
                </SortTh>
                <SortTh k="unanswered" sort={sort} align="right">
                  No answer
                </SortTh>
                <SortTh k="rating" sort={sort}>
                  Rating
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((s) => {
                const qs = queriesOf(s)
                const un = qs.filter((x) => x.status === 'unanswered').length
                return (
                  <tr key={s.id} onClick={() => navigate(`/visitors/${s.id}`)} className="cursor-pointer hover:bg-surface-2">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Mono className="font-medium whitespace-nowrap text-ink">{s.id}</Mono>
                        {s.endedAt === null ? (
                          <Badge tone="good">
                            <span className="relative size-1.5 rounded-full bg-good text-good live-dot" />
                            Inside
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        <Mono className="text-[11.5px]">{s.deviceId}</Mono> · {GROUP_LABEL[s.group]}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-ink tnum">{fmtTime(s.startedAt)}</div>
                      <div className="text-[12px] text-ink-3">{fmtDate(s.startedAt)}</div>
                    </Td>
                    <Td align="right">
                      <span className={cx(s.endedAt === null && 'text-ink-3')}>{fmtMin(durationMin(s))}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <LangTag lang={s.lang} />
                        <div className="leading-tight">
                          <div className="text-ink-2">{LANG_NAME[s.lang]}</div>
                          <div className="mt-0.5 text-[12px] text-ink-3">{MODE_NAME[s.mode]}</div>
                        </div>
                      </div>
                    </Td>
                    <Td align="right">{s.stops.length}</Td>
                    <Td align="right">{qs.length}</Td>
                    <Td align="right">{un ? <span className="font-medium text-bad">{un}</span> : <span className="text-ink-3">0</span>}</Td>
                    <Td>
                      <Stars rating={s.rating} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <Empty title="No visits match">Clear a filter or pick a longer date range.</Empty>}
        </ScrollX>
        {rows.length > limit && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
            <span className="tnum">
              Showing {fmtInt(limit)} of {fmtInt(rows.length)}
            </span>
            <Button size="sm" onClick={() => setLimit(limit + PAGE * 2)}>
              Show more
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}
