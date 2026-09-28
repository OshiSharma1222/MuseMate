import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { HERO_PHOTOS, photoFor, type Photo } from '../lib/photos'

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g

/**
 * Rolls the number inside a formatted value ("1,284", "12.5%", "42 min") up
 * to its new value. Text with no number, or more than one ("1 h 12 min"), is
 * shown as is.
 */
export function CountUp({ text }: { text: string }) {
  const matches = [...text.matchAll(NUMBER)]
  const m = matches.length === 1 ? matches[0] : null
  const target = m ? Number(m[0].replace(/,/g, '')) : 0
  const [n, setN] = useState(() => (m && !reducedMotion() ? 0 : target))
  const shown = useRef(n)

  useEffect(() => {
    const from = shown.current
    if (from === target || reducedMotion()) {
      shown.current = target
      setN(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      const v = from + (target - from) * (1 - (1 - p) ** 3)
      shown.current = v
      setN(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  if (!m) return <>{text}</>
  const decimals = m[0].split('.')[1]?.length ?? 0
  const body = n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return (
    <>
      {text.slice(0, m.index)}
      {body}
      {text.slice(m.index + m[0].length)}
    </>
  )
}

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
  large,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  large?: boolean
}) {
  return (
    <div className="banner-text min-w-0">
      {eyebrow && <div className="eyebrow mb-2 text-white/70! print:text-ink-3!">{eyebrow}</div>}
      <h1
        className={
          large
            ? 'font-serif text-[46px] leading-[1] tracking-[-0.01em] sm:text-[60px] print:text-[40px] print:text-ink'
            : 'font-serif text-[40px] leading-[1.05] tracking-[-0.01em] sm:text-[46px] print:text-[40px] print:text-ink'
        }
      >
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

/** Specks of light drifting up through the gallery, like dust in a spotlight. */
function Motes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
      {Array.from({ length: 22 }, (_, k) => (
        <span
          key={k}
          className="mote"
          style={
            {
              left: `${(k * 37 + 11) % 100}%`,
              width: 2 + (k % 3),
              animationDuration: `${11 + ((k * 13) % 9)}s`,
              animationDelay: `-${(k * 1.9) % 14}s`,
              '--glow': 0.35 + ((k * 7) % 5) / 10,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** The overview's front door: a slow slideshow of the galleries. */
export function HeroBanner({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
}) {
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (reducedMotion()) return
    const id = setInterval(() => setSlide((s) => (s + 1) % HERO_PHOTOS.length), 7000)
    return () => clearInterval(id)
  }, [slide])

  return (
    <div className={SHELL}>
      {HERO_PHOTOS.map((p, k) => (
        <img
          key={p.src}
          src={p.src}
          alt=""
          className={`absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-out print:hidden ${
            k === slide ? 'kenburns opacity-100' : 'opacity-0'
          }`}
          style={{ objectPosition: p.focus }}
        />
      ))}
      <div className="banner-shade absolute inset-0 print:hidden" />
      <Motes />
      <Credit photo={HERO_PHOTOS[slide]} />
      <div className="relative flex min-h-[320px] flex-wrap items-end justify-between gap-6 p-6 pb-11 sm:min-h-[360px] sm:p-9 print:min-h-0 print:p-0">
        <BannerText eyebrow={eyebrow} title={title} description={description} large />
        {aside && <div className="banner-text banner-text-late print:hidden">{aside}</div>}
      </div>
      <div className="absolute bottom-4 left-1/2 z-[1] flex -translate-x-1/2 gap-1.5 sm:right-6 sm:left-auto sm:translate-x-0 print:hidden">
        {HERO_PHOTOS.map((p, k) => (
          <button
            key={p.src}
            onClick={() => setSlide(k)}
            aria-label={`Show photo ${k + 1} of ${HERO_PHOTOS.length}`}
            aria-current={k === slide}
            className={`h-1.5 rounded-full transition-all duration-500 ${k === slide ? 'w-6 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75'}`}
          />
        ))}
      </div>
    </div>
  )
}
