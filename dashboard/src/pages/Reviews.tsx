import { Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Card, CardHeader, Empty, LangTag, Meter, Mono, PageHeader, ScrollArea, Segmented, Select, cx } from '../components/ui'
import { MODE_NAME, REVIEW_TAGS } from '../data/catalog'
import { languages, reviewStats } from '../data/selectors'
import { useVersion } from '../data/store'
import type { ReviewTag } from '../data/types'
import { fmt1, fmtDate, fmtInt, fmtPct } from '../lib/format'
import { useRange } from '../lib/range'
import { Stars } from './Visitors'

type Tone = 'all' | 'praise' | 'critical'

export default function Reviews() {
  const v = useVersion()
  const { range } = useRange()
  const r = reviewStats(v, range.from, range.to)
  const langs = languages(v, range.from, range.to).filter((l) => l.rated >= 3)
  const [tone, setTone] = useState<Tone>('all')
  const [tag, setTag] = useState<ReviewTag | 'all'>('all')
  const [limit, setLimit] = useState(30)

  const maxDist = Math.max(1, ...r.dist.map((d) => d.count))
  const praise = r.tags.filter((t) => t.positive)
  const complaints = r.tags.filter((t) => !t.positive)
  const maxTag = Math.max(1, ...r.tags.map((t) => t.count))

  const list = r.reviews.filter(
    (s) =>
      (tone === 'all' || (tone === 'praise' ? (s.rating ?? 0) >= 4 : (s.rating ?? 0) <= 3)) &&
      (tag === 'all' || s.review!.tags.includes(tag)),
  )

  return (
    <>
      <PageHeader
        eyebrow={`Visitors · ${range.label}`}
        title="Reviews"
        description="When a handheld goes back to the counter, the guide asks for a rating out of five and one sentence about the visit. Both are spoken, so no screen is needed."
      />

      <div className="mb-5 grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <div className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="sm:pr-2">
              <div className="text-[13px] text-ink-2">Average rating</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-serif text-[60px] leading-none text-ink tnum">{r.avg ? fmt1(r.avg) : '–'}</span>
                <span className="text-[15px] text-ink-3">/ 5</span>
              </div>
              <div className="mt-2">
                <Stars rating={r.avg ? Math.round(r.avg) : null} />
              </div>
              <div className="mt-3 text-[12.5px] text-ink-3">
                {fmtInt(r.rated)} ratings
                <br />
                {fmtPct(r.responseRate)} of finished visits
              </div>
            </div>
            <ul className="space-y-2 self-center">
              {r.dist.map((d) => (
                <li key={d.rating} className="grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-3 text-[12.5px]">
                  <span className="inline-flex items-center gap-0.5 text-ink-2 tnum">
                    {d.rating}
                    <Star size={11} strokeWidth={0} className="fill-ink-3" />
                  </span>
                  <Meter value={d.count} max={maxDist} tone={d.rating <= 2 ? 'bad' : d.rating === 3 ? 'warn' : 'accent'} />
                  <span className="text-right text-ink-3 tnum">{fmtInt(d.count)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-4 border-t border-line">
            {r.byMode.map((m) => (
              <div key={m.mode} className="border-r border-line px-4 py-3 last:border-r-0">
                <div className="text-[12px] text-ink-3">{m.name}</div>
                <div className="mt-0.5 font-serif text-[22px] leading-tight text-ink">{m.avg ? fmt1(m.avg) : '–'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="What reviews mention" subtitle="Themes tagged from the spoken comments" />
          <div className="grid gap-6 px-5 pb-5 sm:grid-cols-2">
            {[
              { title: 'Praise', rows: praise, tone: 'accent' as const },
              { title: 'Complaints', rows: complaints, tone: 'bad' as const },
            ].map((col) => (
              <div key={col.title}>
                <div className="eyebrow mb-2">{col.title}</div>
                <ul className="space-y-2.5">
                  {col.rows.map((t) => (
                    <li key={t.tag}>
                      <button
                        onClick={() => setTag(tag === t.tag ? 'all' : t.tag)}
                        className={cx('w-full text-left', tag === t.tag && 'rounded-md ring-2 ring-accent ring-offset-4 ring-offset-surface')}
                      >
                        <div className="mb-1 flex justify-between text-[12.5px]">
                          <span className="text-ink">{t.label}</span>
                          <span className="text-ink-3 tnum">{t.count}</span>
                        </div>
                        <Meter value={t.count} max={maxTag} tone={col.tone} />
                      </button>
                    </li>
                  ))}
                  {!col.rows.length && <li className="text-[12.5px] text-ink-3">None yet</li>}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Rating by language" subtitle="Where narration quality differs" />
          <ul className="px-5 pb-4">
            {langs
              .filter((l) => l.avgRating !== null)
              .sort((a, b) => (a.avgRating ?? 0) - (b.avgRating ?? 0))
              .map((l) => {
                const low = r.avg !== null && (l.avgRating ?? 5) < r.avg - 0.3
                return (
                  <li key={l.lang} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-b-0">
                    <LangTag lang={l.lang} />
                    <span className="flex-1 text-ink">{l.name}</span>
                    <span className="text-[12px] text-ink-3 tnum">{l.rated}</span>
                    <span className={cx('w-9 text-right font-medium tnum', low ? 'text-bad' : 'text-ink')}>{fmt1(l.avgRating!)}</span>
                  </li>
                )
              })}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <h2 className="font-serif text-[22px] leading-[1.15] text-ink">Comments</h2>
              <p className="text-[13px] text-ink-3">{fmtInt(list.length)} with a spoken comment</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={tag} onChange={(e) => setTag(e.target.value as ReviewTag | 'all')} aria-label="Theme">
                <option value="all">All themes</option>
                {(Object.keys(REVIEW_TAGS) as ReviewTag[]).map((t) => (
                  <option key={t} value={t}>
                    {REVIEW_TAGS[t].label}
                  </option>
                ))}
              </Select>
              <Segmented<Tone>
                value={tone}
                onChange={setTone}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'praise', label: '4–5 ★' },
                  { value: 'critical', label: '1–3 ★' },
                ]}
              />
            </div>
          </div>
          <ScrollArea maxHeight="min(640px, 72vh)" className="border-t border-line">
            <ul className="divide-y divide-line">
              {list.slice(0, limit).map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars rating={s.rating} />
                    <span className="flex items-center gap-2 text-[12px] text-ink-3">
                      <LangTag lang={s.lang} />
                      <Link to={`/visitors/${s.id}`} className="hover:text-accent">
                        <Mono className="text-[12px]">{s.id}</Mono>
                      </Link>
                      <span>·</span>
                      <span>{MODE_NAME[s.mode]} mode</span>
                      <span>·</span>
                      <span>{fmtDate(s.endedAt ?? s.startedAt)}</span>
                    </span>
                  </div>
                  <p className="mt-2 font-serif text-[19px] leading-snug text-ink">“{s.review!.text}”</p>
                  {s.review!.text !== s.review!.textEn && <p className="mt-0.5 text-[12.5px] text-ink-3">{s.review!.textEn}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.review!.tags.map((t) => (
                      <Badge key={t} tone={REVIEW_TAGS[t].positive ? 'good' : 'bad'}>
                        {REVIEW_TAGS[t].label}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
              {!list.length && <Empty title="No comments match" />}
            </ul>
          </ScrollArea>
          {list.length > limit && (
            <div className="border-t border-line px-5 py-3 text-center">
              <button onClick={() => setLimit(limit + 30)} className="text-[12.5px] font-medium text-accent hover:underline">
                Show 30 more of {fmtInt(list.length - limit)}
              </button>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
