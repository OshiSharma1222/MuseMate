import { Download, PencilLine, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArtifactGlyph } from '../components/bits'
import { SortTh, useSort } from '../components/table'
import { Badge, Button, Card, Empty, Meter, Mono, PageHeader, SearchInput, Segmented, Select, Td, cx } from '../components/ui'
import { GALLERIES, GALLERY_BY_ID } from '../data/catalog'
import { exportArtifacts } from '../data/exports'
import { artifactStats, type ArtifactStat } from '../data/selectors'
import { getArtifacts, isEdited, useVersion } from '../data/store'
import type { Artifact, GalleryId } from '../data/types'
import { fmtInt, fmtPct, fmtSec } from '../lib/format'
import { useRange } from '../lib/range'

type SortKey = 'name' | 'gallery' | 'visitors' | 'queries' | 'dwell' | 'skip' | 'unanswered'
type StatusFilter = 'all' | 'review' | 'edited'

const EMPTY_STAT: ArtifactStat = {
  id: '',
  taps: 0,
  visitors: 0,
  queries: 0,
  unanswered: 0,
  unansweredRate: 0,
  avgDwellSec: 0,
  skipRate: 0,
  replayRate: 0,
  retryRate: 0,
  avgListened: 0,
  reach: 0,
}

export default function Artifacts() {
  const v = useVersion()
  const { range } = useRange()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [gallery, setGallery] = useState<GalleryId | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const sort = useSort<SortKey>('visitors')

  const artifacts = getArtifacts()
  const stats = artifactStats(v, range.from, range.to)
  const maxVisitors = Math.max(1, ...[...stats.values()].map((s) => s.visitors))
  const needReview = artifacts.filter((a) => !a.verified).length
  const edited = artifacts.filter((a) => isEdited(a.id)).length

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = artifacts.filter(
      (a) =>
        (gallery === 'all' || a.gallery === gallery) &&
        (status === 'all' || (status === 'review' ? !a.verified : isEdited(a.id))) &&
        (!needle ||
          [a.name, a.accession, a.period, a.region, a.material].some((f) => f.toLowerCase().includes(needle))),
    )
    return sort.sort(filtered, (a: Artifact, k) => {
      const s = stats.get(a.id) ?? EMPTY_STAT
      switch (k) {
        case 'name':
          return a.name
        case 'gallery':
          return GALLERY_BY_ID[a.gallery].room
        case 'visitors':
          return s.visitors
        case 'queries':
          return s.queries
        case 'dwell':
          return s.avgDwellSec
        case 'skip':
          return s.skipRate
        case 'unanswered':
          return s.unansweredRate
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, gallery, status, sort.key, sort.dir, v, range.from])

  return (
    <>
      <PageHeader
        eyebrow="Collection"
        title="Artifacts"
        description="Everything the handhelds can narrate. Open an artifact to edit what the guide says about it and see how visitors respond."
        actions={
          <Button icon={<Download size={15} />} onClick={() => exportArtifacts(v, range.from, range.to, range.key)}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder="Search name, accession, period…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-72"
        />
        <Select value={gallery} onChange={(e) => setGallery(e.target.value as GalleryId | 'all')} aria-label="Gallery">
          <option value="all">All galleries</option>
          {GALLERIES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.room} · {g.name}
            </option>
          ))}
        </Select>
        <Segmented<StatusFilter>
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: `All ${artifacts.length}` },
            { value: 'review', label: `Needs review ${needReview}` },
            { value: 'edited', label: `Edited ${edited}` },
          ]}
        />
        <span className="ml-auto text-[12.5px] text-ink-3">Engagement for {range.label.toLowerCase()}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[960px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <SortTh k="name" sort={sort} firstDir="asc">
                  Artifact
                </SortTh>
                <SortTh k="gallery" sort={sort} firstDir="asc">
                  Gallery
                </SortTh>
                <SortTh k="visitors" sort={sort}>
                  Visitors
                </SortTh>
                <SortTh k="queries" sort={sort} align="right">
                  Questions
                </SortTh>
                <SortTh k="dwell" sort={sort} align="right">
                  Avg dwell
                </SortTh>
                <SortTh k="skip" sort={sort} align="right">
                  Skipped
                </SortTh>
                <SortTh k="unanswered" sort={sort} align="right">
                  Unanswered
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const s = stats.get(a.id) ?? EMPTY_STAT
                const g = GALLERY_BY_ID[a.gallery]
                return (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/artifacts/${a.id}`)}
                    className="cursor-pointer transition-colors hover:bg-surface-2"
                  >
                    <Td>
                      <div className="flex max-w-[360px] items-center gap-3">
                        <ArtifactGlyph kind={a.kind} size={34} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-ink">{a.name}</span>
                            {!a.verified && (
                              <Badge tone="warn" className="shrink-0">
                                <TriangleAlert size={11} strokeWidth={2.4} />
                                Review
                              </Badge>
                            )}
                            {isEdited(a.id) && (
                              <Badge tone="accent" className="shrink-0">
                                <PencilLine size={11} strokeWidth={2.4} />
                                Edited
                              </Badge>
                            )}
                          </div>
                          <div className="flex min-w-0 items-center gap-2 text-[12px] whitespace-nowrap text-ink-3">
                            <Mono className="text-[11.5px]">{a.accession}</Mono>
                            <span>·</span>
                            <span className="truncate">{a.period}</span>
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Mono className="rounded border border-line px-1 text-[11px] text-ink-2">{g.room}</Mono>
                        <span className="text-ink-2">{g.name}</span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="w-9 text-right text-ink tnum">{fmtInt(s.visitors)}</span>
                        <div className="w-14">
                          <Meter value={s.visitors} max={maxVisitors} />
                        </div>
                      </div>
                    </Td>
                    <Td align="right">{fmtInt(s.queries)}</Td>
                    <Td align="right">{s.taps ? fmtSec(s.avgDwellSec) : '–'}</Td>
                    <Td align="right">
                      <span className={cx(s.skipRate > 0.36 && 'font-medium text-bad')}>{s.taps ? fmtPct(s.skipRate) : '–'}</span>
                    </Td>
                    <Td align="right">
                      <span className={cx(s.unansweredRate > 0.3 && 'font-medium text-bad')}>
                        {s.queries ? fmtPct(s.unansweredRate) : '–'}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <Empty title="No artifacts match">Try a different search or gallery.</Empty>}
        </div>
      </Card>
    </>
  )
}
