import {
  Amphora,
  BookOpenText,
  CircleCheck,
  CircleHelp,
  Coins,
  Flame,
  Guitar,
  Landmark,
  LogIn,
  LogOut,
  MessageCircleQuestion,
  MinusCircle,
  Nfc,
  Palette,
  Shirt,
  Stamp,
  Swords,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { GALLERY_BY_ID, LANG_NAME } from '../data/catalog'
import { getArtifact, getFeed, useVersion, type FeedEvent } from '../data/store'
import type { AnswerStatus, ArtifactKind } from '../data/types'
import { fmtAgo } from '../lib/format'
import { Badge, LangTag, Mono, cx } from './ui'

const KIND_ICON: Record<ArtifactKind, LucideIcon> = {
  seal: Stamp,
  sculpture: Landmark,
  bronze: Flame,
  painting: Palette,
  textile: Shirt,
  arms: Swords,
  coin: Coins,
  manuscript: BookOpenText,
  vessel: Amphora,
  instrument: Guitar,
}

/** Stand-in for a photo: the kind of object, drawn on a paper tile. */
export function ArtifactGlyph({ kind, size = 36 }: { kind: ArtifactKind; size?: number }) {
  const Icon = KIND_ICON[kind]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-2"
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.5} />
    </span>
  )
}

export function ArtifactLink({ id, showGallery = true }: { id: string; showGallery?: boolean }) {
  const a = getArtifact(id)
  if (!a) return <span className="text-ink-3">{id}</span>
  return (
    <Link to={`/artifacts/${id}`} className="group flex min-w-0 items-center gap-3">
      <ArtifactGlyph kind={a.kind} size={32} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink group-hover:text-accent">{a.name}</span>
        {showGallery && (
          <span className="block truncate text-[12px] text-ink-3">
            {GALLERY_BY_ID[a.gallery].room} · {GALLERY_BY_ID[a.gallery].name}
          </span>
        )}
      </span>
    </Link>
  )
}

export function StatusBadge({ status }: { status: AnswerStatus }) {
  if (status === 'answered')
    return (
      <Badge tone="good">
        <CircleCheck size={12} strokeWidth={2.2} />
        Answered
      </Badge>
    )
  if (status === 'declined')
    return (
      <Badge tone="neutral">
        <MinusCircle size={12} strokeWidth={2.2} />
        Declined
      </Badge>
    )
  return (
    <Badge tone="bad">
      <CircleHelp size={12} strokeWidth={2.2} />
      No answer
    </Badge>
  )
}

export function VisitorLink({ id }: { id: string }) {
  return (
    <Link to={`/visitors/${id}`} className="text-ink hover:text-accent">
      <Mono>{id}</Mono>
    </Link>
  )
}

const FEED_ICON: Record<FeedEvent['kind'], LucideIcon> = {
  start: LogIn,
  tap: Nfc,
  query: MessageCircleQuestion,
  end: LogOut,
}

function FeedLine({ e }: { e: FeedEvent }) {
  const Icon = FEED_ICON[e.kind]
  const art = e.artifactId ? getArtifact(e.artifactId) : null
  return (
    <li className="feed-enter flex gap-3 px-5 py-2.5">
      <span
        className={cx(
          'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full',
          e.kind === 'query' ? 'bg-accent-wash text-accent' : 'bg-surface-3 text-ink-3',
        )}
      >
        <Icon size={13} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-ink-2">
            <Link to={`/visitors/${e.sessionId}`} className="font-mono text-[12px] text-ink hover:text-accent">
              {e.sessionId}
            </Link>{' '}
            {e.kind === 'start' && <>picked up {e.deviceId}</>}
            {e.kind === 'end' && <>returned {e.deviceId}</>}
            {e.kind === 'tap' && art && (
              <>
                tapped{' '}
                <Link to={`/artifacts/${art.id}`} className="text-ink hover:text-accent">
                  {art.name}
                </Link>
              </>
            )}
            {e.kind === 'query' && art && <>asked about {art.name}</>}
            {e.kind === 'query' && !art && <>asked for directions</>}
          </span>
          <span className="shrink-0 text-[11.5px] text-ink-3 tnum">{fmtAgo(e.at)}</span>
        </div>
        {e.kind === 'query' && e.query && (
          <div className="mt-1 flex items-start gap-2">
            <span className="min-w-0 flex-1 text-ink">“{e.query.text}”</span>
            <span className="mt-px flex shrink-0 items-center gap-1.5">
              <LangTag lang={e.lang} />
              {e.query.status === 'unanswered' && <Badge tone="bad">No answer</Badge>}
            </span>
          </div>
        )}
        {e.kind === 'start' && (
          <div className="mt-0.5 text-[12px] text-ink-3">Narration in {LANG_NAME[e.lang]}</div>
        )}
      </div>
    </li>
  )
}

export function LiveFeed({ limit = 12 }: { limit?: number }) {
  useVersion()
  const feed = getFeed().slice(0, limit)
  return (
    <ul className="divide-y divide-line" aria-live="polite">
      {feed.map((e) => (
        <FeedLine key={e.id} e={e} />
      ))}
    </ul>
  )
}
