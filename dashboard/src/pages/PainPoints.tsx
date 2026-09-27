import { ArrowRight, BookOpenText, Check, Cpu, Footprints, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Badge, Button, Card, Empty, LangTag, PageHeader, Segmented, cx } from '../components/ui'
import { painPoints, type Issue } from '../data/selectors'
import { getResolved, setResolved, useVersion } from '../data/store'
import { fmtAgo, fmtInt } from '../lib/format'
import { useRange } from '../lib/range'

const KIND = {
  content: { label: 'Content', icon: BookOpenText, hint: 'Fix in the catalogue' },
  device: { label: 'Hardware & network', icon: Cpu, hint: 'Fix on the floor' },
  experience: { label: 'Visitor experience', icon: Footprints, hint: 'Fix in the visit' },
} as const

const SEV_TONE = { high: 'bad', medium: 'warn', low: 'neutral' } as const

type Filter = 'open' | 'all' | Issue['kind']

function IssueCard({ issue, resolvedAt }: { issue: Issue; resolvedAt?: number }) {
  const K = KIND[issue.kind]
  const done = resolvedAt !== undefined
  return (
    <Card className={cx('scroll-mt-24 transition-opacity', done && 'opacity-60')}>
      <div id={issue.key} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={SEV_TONE[issue.severity]} className="capitalize">
              {issue.severity}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
              <K.icon size={13} /> {K.label}
            </span>
            {done && (
              <Badge tone="good">
                <Check size={11} strokeWidth={2.6} /> Handled {fmtAgo(resolvedAt)}
              </Badge>
            )}
          </div>
          <h3 className={cx('text-[16px] leading-snug font-semibold text-ink', done && 'line-through decoration-ink-3')}>{issue.title}</h3>
          <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">{issue.detail}</p>

          {issue.samples.length > 0 && (
            <div className="mt-3.5">
              <div className="eyebrow mb-1.5">What visitors asked</div>
              <ul className="space-y-1.5">
                {issue.samples.map((q) => (
                  <li key={q.id} className="flex items-start gap-2 text-[13px]">
                    <LangTag lang={q.lang} />
                    <span className="text-ink">
                      “{q.text}”{q.text !== q.textEn && <span className="text-ink-3"> · {q.textEn}</span>}
                      {q.text === q.textEn && q.lang !== 'en' && <span className="text-ink-3"> · translated</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {issue.artifacts.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              <span className="eyebrow mr-1">Where</span>
              {issue.artifacts.map((a) => (
                <Link
                  key={a.id}
                  to={`/artifacts/${a.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-0.5 text-[12.5px] text-ink hover:border-accent hover:text-accent"
                >
                  {a.name}
                  <span className="text-ink-3 tnum">
                    {a.count}
                    {issue.key === 'high-skip' ? '%' : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-lg bg-surface-2 p-4">
          <div>
            <div className="text-[24px] leading-none font-semibold tracking-[-0.02em] text-ink">{issue.metric}</div>
            <div className="mt-1.5 text-[12.5px] text-ink-3">
              {fmtInt(issue.affected)} {issue.affectedLabel} affected
            </div>
          </div>
          <div>
            <div className="eyebrow mb-1">Suggested fix · {K.hint}</div>
            <p className="text-[13px] text-ink">{issue.action}</p>
          </div>
          <div className="flex gap-2">
            {done ? (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setResolved(issue.key, false)}>
                Reopen
              </Button>
            ) : (
              <Button size="sm" icon={<Check size={13} />} onClick={() => setResolved(issue.key, true)}>
                Mark handled
              </Button>
            )}
            {issue.artifacts[0] && !done && (
              <Link
                to={`/artifacts/${issue.artifacts[0].id}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium whitespace-nowrap text-accent hover:bg-accent-wash"
              >
                Open artifact <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function PainPoints() {
  const v = useVersion()
  const { range } = useRange()
  const { hash } = useLocation()
  const [filter, setFilter] = useState<Filter>('open')
  const resolved = getResolved()
  const issues = painPoints(v, range.from, range.to)
  const open = issues.filter((i) => !resolved[i.key])
  const shown =
    filter === 'open' ? open : filter === 'all' ? issues : issues.filter((i) => i.kind === filter && !resolved[i.key])

  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const counts = { high: open.filter((i) => i.severity === 'high').length, total: open.length }

  return (
    <>
      <PageHeader
        eyebrow={`Act on it · ${range.label}`}
        title="Pain points"
        description={
          <>
            Where the visit goes wrong, worked out from unanswered questions, device telemetry and reviews.{' '}
            {counts.total ? (
              <>
                <span className="font-medium text-ink">{counts.total} open</span>, {counts.high} of them high severity.
              </>
            ) : (
              'Nothing open.'
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Filter>
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `Open ${open.length}` },
            { value: 'content', label: 'Content' },
            { value: 'device', label: 'Hardware' },
            { value: 'experience', label: 'Experience' },
            { value: 'all', label: 'All incl. handled' },
          ]}
        />
      </div>

      <div className="space-y-4">
        {shown.map((i) => (
          <IssueCard key={i.key} issue={i} resolvedAt={resolved[i.key]} />
        ))}
        {!shown.length && (
          <Card>
            <Empty icon={<Check size={22} />} title="Nothing to fix here">
              Every pain point in this view is marked handled, or none were found for this period.
            </Empty>
          </Card>
        )}
      </div>
    </>
  )
}
