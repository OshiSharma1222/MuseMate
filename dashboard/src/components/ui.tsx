import { ArrowDownRight, ArrowUpRight, Minus, Search } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { fmtPct } from '../lib/format'
import { CountUp, PageBanner } from './scenery'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('card-rise min-w-0 rounded-xl border border-line bg-surface shadow-card', className)}>{children}</section>
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  )
}

/** Every page opens on a photo of its gallery. */
export const PageHeader = PageBanner

/**
 * Change against the comparison period. `goodWhen` says which direction is
 * good news: more visitors is good, more unanswered questions is not.
 */
export function Delta({
  value,
  goodWhen = 'up',
  suffix,
}: {
  value: number | null
  goodWhen?: 'up' | 'down'
  suffix?: string
}) {
  if (value === null || !isFinite(value)) return <span className="text-[12px] text-ink-3">no comparison</span>
  const flat = Math.abs(value) < 0.005
  const up = value > 0
  const good = flat ? null : (up && goodWhen === 'up') || (!up && goodWhen === 'down')
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 text-[12px] font-medium tnum',
        good === null ? 'text-ink-3' : good ? 'text-good' : 'text-bad',
      )}
    >
      <Icon size={13} strokeWidth={2.2} aria-hidden />
      {fmtPct(Math.abs(value), Math.abs(value) < 0.1 ? 1 : 0)}
      {suffix && <span className="ml-1 font-normal text-ink-3">{suffix}</span>}
    </span>
  )
}

export function Stat({
  label,
  value,
  unit,
  delta,
  foot,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  delta?: ReactNode
  foot?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink tnum">
          {typeof value === 'string' ? <CountUp text={value} /> : value}
        </span>
        {unit && <span className="text-[14px] text-ink-3">{unit}</span>}
      </div>
      {(delta || foot) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          {delta}
          {foot}
        </div>
      )}
    </div>
  )
}

type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-wash text-accent-ink',
  good: 'bg-good-wash text-good',
  warn: 'bg-warn-wash text-warn',
  bad: 'bg-bad-wash text-bad',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] leading-[1.35] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3.5 text-[13.5px]',
        variant === 'primary' && 'bg-ink text-page hover:bg-ink/88',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-surface-3 p-0.5 scroll-thin">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'shrink-0 rounded-[7px] font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-6 px-2 text-[12px]' : 'h-8 px-3 text-[13px]',
              on ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('relative inline-flex items-center', className)}>
      <Search size={15} className="pointer-events-none absolute left-2.5 text-ink-3" aria-hidden />
      <input
        type="search"
        {...rest}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-[13.5px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
    </label>
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        'h-9 appearance-none rounded-lg border border-line-strong bg-surface bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-[13.5px] text-ink focus:border-accent focus:outline-none',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a847a' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
    >
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      {label}
    </label>
  )
}

/** A thin horizontal bar for table cells and ranked lists. */
export function Meter({ value, max = 1, tone = 'accent' }: { value: number; max?: number; tone?: 'accent' | 'bad' | 'warn' | 'muted' }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0)) * 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={cx(
          'meter-fill h-full rounded-full',
          tone === 'accent' && 'bg-s1',
          tone === 'bad' && 'bg-bad',
          tone === 'warn' && 'bg-s2',
          tone === 'muted' && 'bg-ink-3',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function LangTag({ lang }: { lang: string }) {
  return (
    <span className="inline-flex h-[18px] min-w-[26px] items-center justify-center rounded border border-line-strong px-1 font-mono text-[10.5px] font-medium tracking-wide text-ink-2 uppercase">
      {lang}
    </span>
  )
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[12.5px] tracking-tight', className)}>{children}</span>
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <div className="text-[14px] font-medium text-ink">{title}</div>
      {children && <div className="mt-1 max-w-sm text-[13px] text-ink-3">{children}</div>}
    </div>
  )
}

export function Th({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' }) {
  return (
    <th
      className={cx(
        'sticky top-0 z-[1] border-b border-line bg-surface px-3 py-2.5 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase first:pl-5 last:pr-5',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' }) {
  return (
    <td
      className={cx(
        'border-b border-line px-3 py-2.5 align-middle first:pl-5 last:pr-5',
        align === 'right' && 'text-right tnum',
        className,
      )}
    >
      {children}
    </td>
  )
}
