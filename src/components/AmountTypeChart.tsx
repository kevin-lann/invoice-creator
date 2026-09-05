import { useState } from 'react'
import { AMOUNT_TYPES, type AmountType } from '../models/AmountType'
import { amountTypeStyles, chartInk } from '../constants/amountType'
import { currencyFormatter } from '../utils/currency'
import type { ReportBucket } from '../utils/invoiceStats'

// A fixed viewBox scaled to the card's width: the whole drawing scales
// together, so nothing has to be re-measured when the window resizes.
const VIEW_WIDTH = 720
const VIEW_HEIGHT = 320
const MARGIN = { top: 12, right: 12, bottom: 40, left: 62 }

const PLOT_LEFT = MARGIN.left
const PLOT_RIGHT = VIEW_WIDTH - MARGIN.right
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT
const BASELINE = VIEW_HEIGHT - MARGIN.bottom
const PLOT_HEIGHT = BASELINE - MARGIN.top

/** Bars never fill their slot -- the leftover is the breathing room. */
const MAX_BAR_WIDTH = 24
/** Surface showing through is what separates stacked segments; no borders. */
const SEGMENT_GAP = 2
const CORNER_RADIUS = 4
/** Past this many columns the axis labels are thinned out. */
const MAX_AXIS_LABELS = 12

/** Axis ticks land on round numbers, so 1 / 2 / 2.5 / 5 times a power of ten. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0)
    return [0]

  const magnitude = 10 ** Math.floor(Math.log10(max / count))
  const step = [1, 2, 2.5, 5, 10]
    .map(multiple => multiple * magnitude)
    .find(candidate => candidate >= max / count) ?? magnitude * 10

  const ticks: number[] = []
  for (let value = 0; value <= max + step / 2; value += step)
    ticks.push(value)
  return ticks
}

const tickLabel = (value: number) => {
  if (value === 0)
    return '$0'
  if (value >= 1000)
    return `$${(value / 1000).toLocaleString('en-CA', { maximumFractionDigits: 1 })}K`
  return `$${value.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

/** A bar with its top corners rounded and its foot square on the baseline. */
const cappedBar = (x: number, y: number, width: number, height: number) => {
  const radius = Math.min(CORNER_RADIUS, width / 2, height)
  return [
    `M${x},${y + height}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + width - radius},${y}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ')
}

/** "parts, labour, parking and HST" -- the series, named for the description. */
const SERIES_PHRASE = AMOUNT_TYPES
  .map(type => amountTypeStyles[type].label)
  .reduce((phrase, label, index) =>
    index === 0 ? label
      : index === AMOUNT_TYPES.length - 1 ? `${phrase} and ${label}`
        : `${phrase}, ${label}`, '')

interface Segment {
  type: AmountType
  y: number
  height: number
}

/** Stacks one column's amounts upward from the baseline. */
function segmentsFor(bucket: ReportBucket, scale: number): Segment[] {
  const segments: Segment[] = []
  let bottom = BASELINE

  for (const type of AMOUNT_TYPES) {
    const value = bucket.amounts[type]
    if (value <= 0)
      continue
    const height = value * scale
    segments.push({ type, y: bottom - height, height })
    bottom -= height
  }

  return segments
}

interface AmountTypeChartProps {
  buckets: ReportBucket[]
  /** Names the slice the columns cover -- range and status -- for the description. */
  scopeLabel: string
}

/**
 * Billings over time as one column per period, split by what the money was
 * for. Colour carries the amount type and nothing else, so the same type keeps
 * the same hue no matter which range is showing.
 */
function AmountTypeChart({ buckets, scopeLabel }: AmountTypeChartProps) {
  const [active, setActive] = useState<number | null>(null)

  const peak = Math.max(0, ...buckets.map(bucket => bucket.total))
  const ticks = niceTicks(peak || 100)
  const top = ticks[ticks.length - 1]
  const scale = PLOT_HEIGHT / top

  const band = PLOT_WIDTH / Math.max(buckets.length, 1)
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.55)
  const labelEvery = Math.ceil(buckets.length / MAX_AXIS_LABELS)

  const seriesTotals = AMOUNT_TYPES.map(type => ({
    type,
    total: buckets.reduce((sum, bucket) => sum + bucket.amounts[type], 0),
  }))

  const activeBucket = active === null ? undefined : buckets[active]
  const activeCentre = active === null ? 0 : PLOT_LEFT + band * (active + 0.5)
  // Kept off the card's edges so a tooltip near either end stays on screen.
  const tooltipLeft = Math.min(88, Math.max(12, (activeCentre / VIEW_WIDTH) * 100))

  return (
    <figure className="m-0">
      {/* The legend carries each series' total, so every colour is readable as
          a number too -- the aqua and yellow slots sit under 3:1 on white. */}
      <figcaption className="flex flex-row flex-wrap gap-x-5 gap-y-2 pb-3">
        {seriesTotals.map(({ type, total }) => (
          <span key={type} className="flex flex-row items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: amountTypeStyles[type].color }}
            />
            <span className="text-slate-600">{amountTypeStyles[type].label}</span>
            <span className="text-slate-900 font-semibold tabular-nums">
              {currencyFormatter.format(total)}
            </span>
          </span>
        ))}
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`Amount billed per period for ${scopeLabel}, split into ${SERIES_PHRASE}. The same figures are in the table below.`}
        >
          {ticks.map(tick => {
            const y = BASELINE - tick * scale
            return (
              <g key={tick}>
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_RIGHT}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? chartInk.axis : chartInk.gridline}
                  strokeWidth={1}
                />
                <text
                  x={PLOT_LEFT - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={chartInk.muted}
                  className="tabular-nums"
                >
                  {tickLabel(tick)}
                </text>
              </g>
            )
          })}

          {buckets.map((bucket, index) => {
            const centre = PLOT_LEFT + band * (index + 0.5)
            const x = centre - barWidth / 2
            const segments = segmentsFor(bucket, scale)
            const isActive = active === index
            const dimmed = active !== null && !isActive

            return (
              <g key={bucket.start}>
                {isActive && (
                  <rect
                    x={centre - band / 2}
                    y={MARGIN.top}
                    width={band}
                    height={PLOT_HEIGHT}
                    fill={chartInk.gridline}
                    opacity={0.35}
                  />
                )}

                <g opacity={dimmed ? 0.45 : 1}>
                  {segments.map((segment, segmentIndex) => {
                    const isTop = segmentIndex === segments.length - 1
                    // Shrinking each upper segment's foot is what opens the
                    // 2px of surface between it and the one beneath.
                    const height = segmentIndex === 0
                      ? segment.height
                      : Math.max(segment.height - SEGMENT_GAP, 1)
                    const fill = amountTypeStyles[segment.type].color

                    return isTop ? (
                      <path
                        key={segment.type}
                        d={cappedBar(x, segment.y, barWidth, height)}
                        fill={fill}
                      />
                    ) : (
                      <rect
                        key={segment.type}
                        x={x}
                        y={segment.y}
                        width={barWidth}
                        height={height}
                        fill={fill}
                      />
                    )
                  })}
                </g>

                {/* The hit area is the whole column, never just the painted bar. */}
                <rect
                  x={centre - band / 2}
                  y={MARGIN.top}
                  width={band}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${bucket.title}: ${currencyFormatter.format(bucket.total)}`}
                  className="outline-none focus-visible:stroke-slate-400"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(current => (current === index ? null : current))}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(current => (current === index ? null : current))}
                />

                {/* Thinned from the right, so the period we are currently in
                    is always the one that keeps its label. */}
                {(buckets.length - 1 - index) % labelEvery === 0 && (
                  <text
                    x={centre}
                    y={BASELINE + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fill={chartInk.muted}
                  >
                    {bucket.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {activeBucket && (
          <div
            className="absolute top-0 z-10 pointer-events-none -translate-x-1/2 bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2 text-xs w-max max-w-[220px]"
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <div className="text-slate-500 pb-1">{activeBucket.title}</div>
            {AMOUNT_TYPES.map(type => (
              <div key={type} className="flex flex-row items-center gap-2 py-[1px]">
                <span
                  aria-hidden="true"
                  className="w-3 h-[2px] rounded-full shrink-0"
                  style={{ backgroundColor: amountTypeStyles[type].color }}
                />
                <span className="text-slate-900 font-semibold tabular-nums">
                  {currencyFormatter.format(activeBucket.amounts[type])}
                </span>
                <span className="text-slate-500">{amountTypeStyles[type].label}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 mt-1 pt-1 flex flex-row justify-between gap-3">
              <span className="text-slate-900 font-semibold tabular-nums">
                {currencyFormatter.format(activeBucket.total)}
              </span>
              <span className="text-slate-500">
                {activeBucket.invoiceCount} invoice{activeBucket.invoiceCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}

export default AmountTypeChart
