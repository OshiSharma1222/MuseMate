import { useEffect, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cx } from './ui'

/*
  Charts follow one set of rules: thin marks, 2px lines, a 10% area wash,
  solid hairline grids, 4px rounded bar ends at most 24px thick, a tooltip on
  every plot, and text in ink colours rather than series colours. Colours are
  read from the CSS tokens so the dark theme needs no chart code.
*/

const TOKENS = ['series-1', 'series-2', 'series-3', 'series-4', 'ink', 'ink-2', 'ink-3', 'grid', 'axis', 'surface', 'surface-3', 'bad', 'line-strong'] as const
type Token = (typeof TOKENS)[number]
export type ThemeColors = Record<Token, string>

function readColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKENS.map((t) => [t, cs.getPropertyValue(`--${t}`).trim()])) as ThemeColors
}

export function useThemeColors() {
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    const update = () => setColors(readColors())
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])
  return colors
}

const axisTick = (c: ThemeColors) => ({ fill: c['ink-3'], fontSize: 11.5, fontFamily: 'inherit' })

export function LegendKey({ color, label, kind = 'line' }: { color: string; label: ReactNode; kind?: 'line' | 'swatch' | 'faint' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
      {kind === 'swatch' ? (
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      ) : (
        <span className="h-[2px] w-3.5 rounded-full" style={{ background: color, opacity: kind === 'faint' ? 0.9 : 1 }} />
      )}
      {label}
    </span>
  )
}

interface TipRow {
  color: string
  label: ReactNode
  value: ReactNode
}

export function TooltipBox({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="min-w-[160px] rounded-lg border border-line-strong bg-surface px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)]">
      <div className="mb-1.5 font-medium text-ink">{title}</div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <span className="size-2 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="font-medium text-ink tnum">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface SeriesSpec<T> {
  key: keyof T & string
  name: string
  color: string
  kind: 'area' | 'line'
  /** Comparison lines are drawn thinner and fainter behind the main series. */
  faint?: boolean
}

export function TrendChart<T extends Record<string, number>>({
  data,
  xKey,
  series,
  height = 240,
  xFormat,
  titleFormat,
  yFormat = (n) => String(n),
  valueFormat,
}: {
  data: T[]
  xKey: keyof T & string
  series: SeriesSpec<T>[]
  height?: number
  xFormat: (v: number) => string
  titleFormat?: (v: number) => string
  yFormat?: (v: number) => string
  valueFormat?: (v: number) => string
}) {
  const c = useThemeColors()
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis
            dataKey={String(xKey)}
            tickFormatter={xFormat}
            tick={axisTick(c)}
            axisLine={{ stroke: c.axis }}
            tickLine={false}
            minTickGap={24}
            tickMargin={8}
          />
          <YAxis tickFormatter={yFormat} tick={axisTick(c)} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: c['line-strong'], strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={(titleFormat ?? xFormat)(Number(label))}
                  rows={series.map((s) => ({
                    color: s.faint ? c['ink-3'] : s.color,
                    label: s.name,
                    value: (valueFormat ?? yFormat)(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0)),
                  }))}
                />
              ) : null
            }
          />
          {series.map((s) =>
            s.kind === 'area' ? (
              <Area
                key={s.key}
                dataKey={String(s.key)}
                name={s.name}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={s.color}
                fillOpacity={0.1}
                activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface, fill: s.color }}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={String(s.key)}
                name={s.name}
                type="monotone"
                stroke={s.faint ? c['ink-3'] : s.color}
                strokeOpacity={s.faint ? 0.55 : 1}
                strokeWidth={s.faint ? 1.5 : 2}
                dot={false}
                activeDot={s.faint ? false : { r: 4, strokeWidth: 2, stroke: c.surface, fill: s.color }}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Columns<T extends Record<string, unknown>>({
  data,
  xKey,
  yKey,
  height = 200,
  color,
  name,
  xFormat = (v) => String(v),
  titleFormat,
  yFormat = (n) => String(n),
  highlight,
}: {
  data: T[]
  xKey: keyof T & string
  yKey: keyof T & string
  height?: number
  color?: string
  name: string
  xFormat?: (v: T[keyof T]) => string
  titleFormat?: (v: T[keyof T]) => string
  yFormat?: (n: number) => string
  /** Index of a bar to draw in the accent; the rest recede. */
  highlight?: number
}) {
  const c = useThemeColors()
  const fill = color ?? c['series-1']
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis
            dataKey={String(xKey)}
            tickFormatter={(v) => xFormat(v)}
            tick={axisTick(c)}
            axisLine={{ stroke: c.axis }}
            tickLine={false}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis tickFormatter={yFormat} tick={axisTick(c)} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: c['surface-3'], opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as T
              return (
                <TooltipBox
                  title={(titleFormat ?? xFormat)(row[xKey])}
                  rows={[{ color: fill, label: name, value: yFormat(Number(row[yKey])) }]}
                />
              )
            }}
          />
          <Bar
            dataKey={String(yKey)}
            name={name}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
              const { x = 0, y = 0, width = 0, height: h = 0, index = 0 } = props
              const r = Math.min(4, width / 2, h)
              const faded = highlight !== undefined && index !== highlight
              return (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`}
                  fill={fill}
                  fillOpacity={faded ? 0.35 : 1}
                />
              )
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Sparkline({ values, width = 96, height = 28, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const c = useThemeColors()
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const step = width / (values.length - 1)
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const stroke = color ?? c['series-1']
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={stroke} fillOpacity={0.1} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(values[values.length - 1])} r={2.5} fill={stroke} stroke={c.surface} strokeWidth={1.5} />
    </svg>
  )
}

/** Six-step single-hue ramp, lightest near zero. */
export function heatColor(value: number, max: number) {
  if (value <= 0) return 'var(--heat-0)'
  const step = Math.min(5, 1 + Math.floor((value / max) * 4.999))
  return `var(--heat-${step})`
}

export function HeatLegend({ max, format }: { max: number; format: (n: number) => string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
      <span>{format(0)}</span>
      <div className="flex gap-[2px]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="h-2.5 w-5 first:rounded-l-sm last:rounded-r-sm" style={{ background: `var(--heat-${i})` }} />
        ))}
      </div>
      <span>{format(max)}</span>
    </div>
  )
}

export function ChartFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('chart-wipe px-3 pb-4', className)}>{children}</div>
}
