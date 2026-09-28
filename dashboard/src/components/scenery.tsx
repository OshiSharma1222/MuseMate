import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { photoFor, type Photo } from '../lib/photos'

/**
 * The gallery photo behind every page, blurred under a paper veil so cards
 * stay readable. Changing section crossfades to that section's room.
 */
export function Backdrop() {
  const photo = photoFor(useLocation().pathname)
  const [layers, setLayers] = useState([photo])

  useEffect(() => {
    setLayers((l) => (l[l.length - 1] === photo ? l : [...l.slice(-1), photo]))
  }, [photo])

  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {layers.map((p) => (
        <img
          key={p.src}
          src={p.src}
          alt=""
          className="backdrop-photo absolute inset-0 size-full object-cover"
          style={{ objectPosition: p.focus }}
        />
      ))}
      <div className="backdrop-veil absolute inset-0" />
    </div>
  )
}

function Credit({ photo }: { photo: Photo }) {
  return (
    <span className="absolute top-3 right-4 z-[1] hidden text-[10.5px] text-white/55 sm:block print:hidden">Photo: {photo.credit}</span>
  )
}

function BannerText({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="banner-text min-w-0">
      {eyebrow && <div className="eyebrow mb-2 text-white/70! print:text-ink-3!">{eyebrow}</div>}
      <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.01em] sm:text-[46px] print:text-[40px] print:text-ink">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl text-[14.5px] text-white/85 [&_.text-ink]:text-white print:text-ink-2 print:[&_.text-ink]:text-ink">
          {description}
        </p>
      )}
    </div>
  )
}

const SHELL =
  'banner relative mb-6 overflow-hidden rounded-2xl bg-[#1d1914] text-white shadow-[0_18px_40px_-24px_rgb(29_27_24/0.6)] print:overflow-visible print:rounded-none print:bg-transparent print:text-ink print:shadow-none'

/** A page title set over a photo of that section's gallery. */
export function PageBanner({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  const photo = photoFor(useLocation().pathname)
  return (
    <div className={SHELL}>
      <img
        src={photo.src}
        alt=""
        className="kenburns absolute inset-0 size-full object-cover print:hidden"
        style={{ objectPosition: photo.focus }}
      />
      <div className="banner-shade absolute inset-0 print:hidden" />
      <Credit photo={photo} />
      <div className="relative flex min-h-[208px] flex-wrap items-end justify-between gap-4 p-6 sm:p-8 print:min-h-0 print:p-0">
        <BannerText eyebrow={eyebrow} title={title} description={description} />
        {actions && <div className="banner-text flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  )
}
