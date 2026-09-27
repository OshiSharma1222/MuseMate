import {
  ChartColumn,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  Monitor,
  Moon,
  Star,
  Sun,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { MUSEUM } from '../data/catalog'
import { painPoints } from '../data/selectors'
import { getActiveCount, getResolved, isLive, setLive, useVersion } from '../data/store'
import { RANGE_OPTIONS, useRange, type RangeKey } from '../lib/range'
import { useTheme, type ThemePref } from '../lib/theme'
import { Segmented, cx } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

function useNav(): { section: string | null; items: NavItem[] }[] {
  const v = useVersion()
  const { range } = useRange()
  const resolved = getResolved()
  const open = painPoints(v, range.from, range.to).filter((i) => i.severity === 'high' && !resolved[i.key]).length
  return [
    {
      section: null,
      items: [
        { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/exhibition', label: 'Exhibition', icon: ChartColumn },
      ],
    },
    { section: 'Collection', items: [{ to: '/artifacts', label: 'Artifacts', icon: Landmark }] },
    {
      section: 'Visitors',
      items: [
        { to: '/visitors', label: 'Visitors', icon: Users },
        { to: '/reviews', label: 'Reviews', icon: Star },
      ],
    },
    {
      section: 'Act on it',
      items: [
        { to: '/pain-points', label: 'Pain points', icon: TriangleAlert, badge: open || undefined },
        { to: '/reports', label: 'Reports', icon: FileText },
      ],
    },
  ]
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="8" className="fill-ink" />
        <path
          d="M9 23V11l7 7 7-7v12"
          fill="none"
          className="stroke-page"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0 leading-tight">
        <div className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">MuseMate</div>
        <div className="truncate text-[11.5px] text-ink-3">{MUSEUM.name}</div>
      </div>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  return (
    <nav className="space-y-5">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.section && <div className="eyebrow mb-1.5 px-2.5">{group.section}</div>}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'group flex h-8 items-center gap-2.5 rounded-lg border px-2.5 text-[13.5px] transition-colors',
                      isActive
                        ? 'border-line bg-surface font-medium text-ink shadow-card'
                        : 'border-transparent text-ink-2 hover:bg-surface-3/70 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={16} strokeWidth={1.75} className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="rounded-md bg-bad-wash px-1.5 text-[11px] leading-[18px] font-semibold text-bad tnum">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function ServerStatus() {
  useVersion()
  const inUse = Math.min(MUSEUM.devices, getActiveCount())
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-ink">Edge server</span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-good">
          <span className="size-1.5 rounded-full bg-good" />
          Online
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[12px] text-ink-3">
        <span>Handhelds in use</span>
        <span className="text-ink-2 tnum">
          {inUse} / {MUSEUM.devices}
        </span>
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {Array.from({ length: MUSEUM.devices }, (_, i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-[1px]', i < inUse ? 'bg-s1' : 'bg-surface-3')} />
        ))}
      </div>
      <div className="mt-2 text-[11.5px] text-ink-3">museum LAN · no internet needed</div>
    </div>
  )
}

function ThemeSwitch() {
  const [pref, setPref] = useTheme()
  return (
    <Segmented<ThemePref>
      size="sm"
      label="Theme"
      value={pref}
      onChange={setPref}
      options={[
        { value: 'light', label: <Sun size={13} aria-label="Light" /> },
        { value: 'dark', label: <Moon size={13} aria-label="Dark" /> },
        { value: 'system', label: <Monitor size={13} aria-label="System" /> },
      ]}
    />
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-2">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="space-y-3">
        <ServerStatus />
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-ink-3">Theme</span>
          <ThemeSwitch />
        </div>
      </div>
    </div>
  )
}

function LivePill() {
  useVersion()
  const on = isLive()
  const inside = getActiveCount()
  return (
    <button
      onClick={() => setLive(!on)}
      title={on ? 'Pause the live feed' : 'Resume the live feed'}
      className={cx(
        'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] transition-colors',
        on ? 'border-line bg-surface text-ink hover:bg-surface-2' : 'border-dashed border-line-strong text-ink-3 hover:text-ink',
      )}
    >
      <span className={cx('relative size-2 rounded-full', on ? 'live-dot bg-good text-good' : 'bg-ink-3')} />
      <span className="font-medium">{on ? 'Live' : 'Paused'}</span>
      <span className="text-ink-3 tnum">{inside} inside</span>
    </button>
  )
}

function RangePicker() {
  const { range, setKey } = useRange()
  return (
    <Segmented<RangeKey>
      label="Date range"
      value={range.key}
      onChange={setKey}
      options={RANGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
    />
  )
}

export function Layout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen border-r border-line lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] border-r border-line bg-page">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-ink-3 hover:bg-surface-3"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setOpen(true)}
              className="-ml-1.5 rounded-md p-1.5 text-ink-2 hover:bg-surface-3 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block">
                <LivePill />
              </div>
              <RangePicker />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children ?? <Outlet />}</main>
      </div>
    </div>
  )
}
