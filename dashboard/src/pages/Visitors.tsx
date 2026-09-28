import { Download, FileSpreadsheet, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { SortTh, useSort } from '../components/table'
import { Button, Card, Empty, Mono, PageHeader, ScrollArea, SearchInput, Select, Td, Toggle } from '../components/ui'
import { LANGS, LANG_NAME, MODES, MODE_NAME } from '../data/catalog'
import { exportQueries, exportVisitors } from '../data/exports'
import { durationMin, queriesOf, sessionsIn } from '../data/selectors'
import type { Lang, Mode, Session } from '../data/types'
import { dayStart } from '../data/seed'
import { useVersion } from '../data/store'
import { fmtDate, fmtDateShort, fmtInt, fmtMin, fmtTime } from '../lib/format'
import { useRange } from '../lib/range'

type SortKey = 'started' | 'duration' | 'artifacts' | 'questions' | 'rating'

const PAGE = 60
/** Day containers shown before "Show earlier days". */
const DAY_PAGE = 7

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Today", "Yesterday" or the weekday, for the register's day headings. */
function dayName(day: number) {
  const today = dayStart(Date.now())
  if (day === today) return 'Today'
  if (day === dayStart(today - 1)) return 'Yesterday'
  return WEEKDAYS[new Date(day).getDay()]
}

/** A blank that still reads as "none" in a column of figures. */
const Nil = () => <span className="text-line-strong">—</span>

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
          className={i <= rating ? (rating <= 2 ? 'fill-bad' : 'fill-accent') : 'fill-surface-3'}
        />
      ))}
    </span>
  )
}

type Sorter = ReturnType<typeof useSort<SortKey>>

const TH = 'sticky top-0 z-[1] border-b border-line-strong bg-surface px-3 text-left col-label'

function VisitTable({ rows, sort, withDate }: { rows: Session[]; sort: Sorter; withDate: boolean }) {
  const navigate = useNavigate()
  return (
    <table className="w-full min-w-[960px] table-fixed border-collapse text-[13.5px]">
      {/* Fixed widths keep the columns lined up from one day to the next. */}
      <colgroup>
        <col className="w-[108px]" />
        <col className="w-[180px]" />
        <col className="w-[120px]" />
        <col />
        <col className="w-[110px]" />
        <col className="w-[80px]" />
        <col className="w-[170px]" />
        <col className="w-[112px]" />
      </colgroup>
      <thead>
        <tr>
          <SortTh k="started" sort={sort}>
            Time
          </SortTh>
          <th className={TH}>Visit</th>
          <th className={TH}>Party</th>
          <th className={TH}>Language</th>
          <SortTh k="duration" sort={sort} align="right">
            Inside for
          </SortTh>
          <SortTh k="artifacts" sort={sort} align="right">
            Stops
          </SortTh>
          <SortTh k="questions" sort={sort} align="right">
            Questions
          </SortTh>
          <SortTh k="rating" sort={sort}>
            Rating
          </SortTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const qs = queriesOf(s)
          const un = qs.filter((x) => x.status === 'unanswered').length
          return (
            <tr key={s.id} onClick={() => navigate(`/visitors/${s.id}`)} className="cursor-pointer hover:bg-surface-2">
              <Td className="whitespace-nowrap text-ink-2 tnum">
                {withDate ? `${fmtDateShort(s.startedAt)}, ${fmtTime(s.startedAt)}` : fmtTime(s.startedAt)}
              </Td>
              <Td className="whitespace-nowrap">
                <Mono className="font-medium text-ink">{s.id}</Mono>
                <Mono className="ml-2 text-[11.5px] text-ink-3">{s.deviceId}</Mono>
              </Td>
              <Td className="whitespace-nowrap text-ink-2">{GROUP_LABEL[s.group]}</Td>
              <Td className="truncate">
                <span className="text-ink">{LANG_NAME[s.lang]}</span>
                <span className="text-ink-3">, {MODE_NAME[s.mode].toLowerCase()}</span>
              </Td>
              <Td align="right" className="whitespace-nowrap">
                {s.endedAt === null ? (
                  <span className="inline-flex items-center gap-2 text-ink" title="Still inside">
                    <span className="live-dot relative size-1.5 rounded-full bg-good text-good" />
                    {fmtMin(durationMin(s))}
                  </span>
                ) : (
                  <span className="text-ink-2">{fmtMin(durationMin(s))}</span>
                )}
              </Td>
              <Td align="right">{s.stops.length || <Nil />}</Td>
              <Td align="right" className="whitespace-nowrap">
                {qs.length ? (
                  <>
                    {qs.length}
                    {un > 0 && (
                      <span className="text-[12px]">
                        <span className="text-ink-3"> · </span>
                        <span className="text-bad">{un} unanswered</span>
                      </span>
                    )}
                  </>
                ) : (
                  <Nil />
                )}
              </Td>
              <Td>{s.rating !== null && <Stars rating={s.rating} />}</Td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Long tables scroll inside their container, so the page keeps its shape. */
const TABLE_HEIGHT = 'min(520px, 64vh)'

export default function Visitors() {
  const v = useVersion()
  const { range } = useRange()
  const [q, setQ] = useState('')
  const [lang, setLang] = useState<Lang | 'all'>('all')
  const [mode, setMode] = useState<Mode | 'all'>('all')
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [dayLimit, setDayLimit] = useState(DAY_PAGE)
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
        case 'rating':
          return s.rating ?? -1
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, lang, mode, onlyGaps, sort.key, sort.dir])

  const label = range.key
  // Sorted by time, visits read as a register with one container per day; any other sort is one flat list.
  const byDay = sort.key === 'started'
  const days: { day: number; rows: Session[]; inside: number }[] = []
  if (byDay)
    for (const s of rows) {
      const day = dayStart(s.startedAt)
      let group = days[days.length - 1]
      if (!group || group.day !== day) days.push((group = { day, rows: [], inside: 0 }))
      group.rows.push(s)
      if (s.endedAt === null) group.inside++
    }

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

      {!rows.length ? (
        <Card>
          <Empty title="No visits match">Clear a filter or pick a longer date range.</Empty>
        </Card>
      ) : byDay ? (
        <div className="space-y-6">
          {days.slice(0, dayLimit).map((g) => {
            const name = dayName(g.day)
            return (
              <Card key={g.day} className="overflow-hidden">
                <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
                  <h2>
                    <span className="font-serif text-[24px] leading-none text-ink">{name}</span>
                    <span className="ml-2.5 text-[13px] text-ink-3">{name === 'Today' || name === 'Yesterday' ? fmtDate(g.day) : fmtDateShort(g.day)}</span>
                  </h2>
                  <span className="text-[12.5px] text-ink-3 tnum">
                    {fmtInt(g.rows.length)} {g.rows.length === 1 ? 'visit' : 'visits'}
                    {g.inside > 0 && <> · {g.inside} inside now</>}
                  </span>
                </header>
                <ScrollArea maxHeight={TABLE_HEIGHT} className="border-t border-line">
                  <VisitTable rows={g.rows} sort={sort} withDate={false} />
                </ScrollArea>
              </Card>
            )
          })}
          {days.length > dayLimit && (
            <div className="flex items-center justify-center gap-3 text-[12.5px] text-ink-3">
              <span className="tnum">
                {dayLimit} of {days.length} days
              </span>
              <Button size="sm" onClick={() => setDayLimit(dayLimit + DAY_PAGE)}>
                Show earlier days
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ScrollArea maxHeight={TABLE_HEIGHT}>
            <VisitTable rows={rows.slice(0, limit)} sort={sort} withDate />
          </ScrollArea>
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
      )}
    </>
  )
}
