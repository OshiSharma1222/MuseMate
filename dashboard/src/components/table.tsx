import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cx } from './ui'

export type SortDir = 'asc' | 'desc'

export function useSort<K extends string>(initial: K, initialDir: SortDir = 'desc') {
  const [key, setKey] = useState<K>(initial)
  const [dir, setDir] = useState<SortDir>(initialDir)
  const toggle = (k: K, firstDir: SortDir = 'desc') => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setKey(k)
      setDir(firstDir)
    }
  }
  const sort = <T,>(rows: T[], value: (row: T, k: K) => number | string) =>
    [...rows].sort((a, b) => {
      const x = value(a, key)
      const y = value(b, key)
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return dir === 'asc' ? c : -c
    })
  return { key, dir, toggle, sort }
}

export function SortTh<K extends string>({
  k,
  sort,
  children,
  align = 'left',
  firstDir,
  className,
}: {
  k: K
  sort: { key: K; dir: SortDir; toggle: (k: K, firstDir?: SortDir) => void }
  children: ReactNode
  align?: 'left' | 'right'
  firstDir?: SortDir
  className?: string
}) {
  const on = sort.key === k
  const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cx(
        'sticky top-0 z-[1] border-b border-line bg-surface px-3 py-0 first:pl-5 last:pr-5',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <button
        onClick={() => sort.toggle(k, firstDir)}
        className={cx(
          'inline-flex h-9 items-center gap-1 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase',
          on ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {children}
        <Icon size={12} strokeWidth={2.4} className={on ? 'opacity-100' : 'opacity-0'} />
      </button>
    </th>
  )
}
