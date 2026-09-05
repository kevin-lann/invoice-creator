import { INVOICE_STATUSES, type InvoiceStatus } from '../models/Invoice'
import {
  addBreakdown,
  breakdownTotal,
  emptyBreakdown,
  type AmountBreakdown,
} from '../models/AmountType'
import {
  addUnits,
  bucketLabel,
  bucketTitle,
  startOfBucket,
  type BucketUnit,
} from './invoiceDate'

/** One saved invoice, reduced to the numbers a report cares about. */
export interface InvoiceStat {
  id: number
  status: InvoiceStatus
  invoiceNo: string
  customerName: string
  /** The invoice's own date, falling back to when it was first saved. */
  dateMs: number
  amounts: AmountBreakdown
  total: number
}

/** How wide a report's window is: one named week, month or year, or everything. */
export const REPORT_PERIODS = ['week', 'month', 'year', 'all'] as const

export type ReportPeriod = typeof REPORT_PERIODS[number]

/** What the buttons that pick the width are called. */
export const reportPeriodLabels: Record<ReportPeriod, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  all: 'All time',
}

/**
 * Which week, month or year is on screen. `start` is that period's first
 * moment; it is kept even while "All time" is showing, so switching away and
 * back returns to the period the reader was last looking at.
 */
export interface ReportSelection {
  period: ReportPeriod
  start: number
}

/** Reports open on the month we are in. */
export const defaultSelection = (now = Date.now()): ReportSelection =>
  ({ period: 'month', start: startOfBucket(now, 'month') })

/**
 * The columns a named period is drawn with. Every one of these nests exactly
 * inside its period -- days divide a week and a month, months divide a year --
 * so no column can straddle the edge and pull a neighbouring period's invoices
 * into the totals.
 */
const PERIOD_COLUMNS: Record<Exclude<ReportPeriod, 'all'>, BucketUnit> = {
  week: 'day',
  month: 'day',
  year: 'month',
}

/**
 * Changes how wide the window is while staying over the same moment, so
 * stepping from August 2026 up to a year lands on 2026 rather than jumping to
 * today.
 */
export const selectPeriod = (selection: ReportSelection, period: ReportPeriod): ReportSelection =>
  period === 'all'
    ? { ...selection, period }
    : { period, start: startOfBucket(selection.start, period) }

/** What the period on screen is called: "August 2026", "2024", "all time". */
export const periodTitle = (selection: ReportSelection): string =>
  selection.period === 'all'
    ? 'all time'
    : bucketTitle(selection.start, selection.period)

/**
 * Where the arrows lead, or `undefined` where they should be dead.
 *
 * The bounds come from the invoices rather than from the calendar: stepping
 * back stops at the period holding the oldest invoice instead of walking off
 * into empty months, and stepping forward reaches the period we are in -- or
 * further, if an invoice is dated ahead of today, so that no invoice can end up
 * somewhere the arrows cannot reach.
 */
export function periodNeighbours(
  stats: InvoiceStat[],
  selection: ReportSelection,
  now = Date.now(),
): { previous?: number; next?: number } {
  if (selection.period === 'all' || stats.length === 0)
    return {}

  const unit = selection.period
  const dates = stats.map(stat => stat.dateMs)
  const earliest = startOfBucket(Math.min(...dates), unit)
  const latest = startOfBucket(Math.max(now, ...dates), unit)

  const previous = addUnits(selection.start, unit, -1)
  const next = addUnits(selection.start, unit, 1)

  return {
    previous: previous >= earliest ? previous : undefined,
    next: next <= latest ? next : undefined,
  }
}

/** The columns of the timeline, and how wide each one is. */
interface Timeline {
  unit: BucketUnit
  starts: number[]
}

/** Coarsest-last, for picking a column width that "All time" can actually draw. */
const UNIT_LADDER: BucketUnit[] = ['day', 'week', 'month', 'year']

/** More columns than this and the axis labels stop being readable. */
const MAX_BUCKETS = 24

/** Stops a span of nonsense dates from spinning the loop below. */
const HARD_CAP = 400

const bucketStarts = (from: number, to: number, unit: BucketUnit): number[] => {
  const starts: number[] = []
  const last = startOfBucket(to, unit)
  let cursor = startOfBucket(from, unit)
  while (cursor <= last && starts.length < HARD_CAP) {
    starts.push(cursor)
    cursor = addUnits(cursor, unit, 1)
  }
  return starts
}

/** The narrowest column width that keeps the whole span under the cap. */
const timelineForSpan = (from: number, to: number): Timeline => {
  for (const unit of UNIT_LADDER) {
    const starts = bucketStarts(from, to, unit)
    if (starts.length <= MAX_BUCKETS || unit === 'year')
      return { unit, starts }
  }
  return { unit: 'year', starts: bucketStarts(from, to, 'year') }
}

const timelineFor = (stats: InvoiceStat[], selection: ReportSelection, now: number): Timeline => {
  if (selection.period !== 'all') {
    const unit = PERIOD_COLUMNS[selection.period]
    const from = startOfBucket(selection.start, selection.period)
    // One millisecond short of the next period, so the last column drawn is the
    // last one that belongs to this period.
    const to = addUnits(from, selection.period, 1) - 1
    return { unit, starts: bucketStarts(from, to, unit) }
  }

  if (stats.length === 0)
    return timelineForSpan(now, now)

  const dates = stats.map(stat => stat.dateMs)
  // An invoice dated in the future still belongs on an all-time timeline.
  return timelineForSpan(Math.min(...dates), Math.max(now, ...dates))
}

/** One column of the chart: what was billed in that slice of time. */
export interface ReportBucket {
  start: number
  /** Short label for the axis. */
  label: string
  /** Spelled-out label for the tooltip. */
  title: string
  amounts: AmountBreakdown
  total: number
  invoiceCount: number
}

export interface StatusTotal {
  total: number
  count: number
}

export interface ReportSummary {
  unit: BucketUnit
  buckets: ReportBucket[]
  /** The invoices inside the range that passed the status filter, newest first. */
  invoices: InvoiceStat[]
  invoiceCount: number
  total: number
  amounts: AmountBreakdown
  /**
   * Every status in the range, counted whether or not the status filter let it
   * through -- these are the numbers on the buttons that drive that filter, so
   * narrowing to one status must not empty the other two.
   */
  byStatus: Record<InvoiceStatus, StatusTotal>
}

const emptyStatusTotals = (): Record<InvoiceStatus, StatusTotal> =>
  Object.fromEntries(
    INVOICE_STATUSES.map(status => [status, { total: 0, count: 0 }]),
  ) as Record<InvoiceStatus, StatusTotal>

/**
 * Buckets and totals every invoice that falls inside the selected period.
 * Anything dated outside the timeline is left out of both the chart and the
 * totals, so every number on the page describes the same set of invoices --
 * which, for a named period, is exactly the invoices dated within it.
 *
 * `status` narrows that set further to one payment status; leaving it out means
 * no status filter at all, which is what deselecting the pressed tile leaves
 * behind.
 *
 * The timeline itself is measured from the period rather than from the
 * invoices that survive the filter, so toggling a status re-draws the columns
 * without moving the axis under them.
 */
export function buildReport(
  stats: InvoiceStat[],
  selection: ReportSelection,
  status?: InvoiceStatus,
  now = Date.now(),
): ReportSummary {
  const { unit, starts } = timelineFor(stats, selection, now)

  // Every label has to identify its own column. Weekday names only manage that
  // over a single week, and bare month names only within one year; past that
  // the axis needs dates and years instead.
  const longSpan = unit === 'day'
    ? starts.length > 7
    : unit === 'month' &&
      new Date(starts[0]).getFullYear() !== new Date(starts[starts.length - 1]).getFullYear()

  const buckets: ReportBucket[] = starts.map(start => ({
    start,
    label: bucketLabel(start, unit, longSpan),
    title: bucketTitle(start, unit),
    amounts: emptyBreakdown(),
    total: 0,
    invoiceCount: 0,
  }))
  const bucketsByStart = new Map(buckets.map(bucket => [bucket.start, bucket]))

  const amounts = emptyBreakdown()
  const byStatus = emptyStatusTotals()
  const invoices: InvoiceStat[] = []

  for (const stat of stats) {
    const bucket = bucketsByStart.get(startOfBucket(stat.dateMs, unit))
    if (!bucket)
      continue

    // Counted before the filter runs, so the buttons keep their totals.
    byStatus[stat.status].total += stat.total
    byStatus[stat.status].count++

    if (status !== undefined && stat.status !== status)
      continue

    addBreakdown(bucket.amounts, stat.amounts)
    bucket.total += stat.total
    bucket.invoiceCount++

    addBreakdown(amounts, stat.amounts)
    invoices.push(stat)
  }

  invoices.sort((a, b) => b.dateMs - a.dateMs)

  return {
    unit,
    buckets,
    invoices,
    invoiceCount: invoices.length,
    total: breakdownTotal(amounts),
    amounts,
    byStatus,
  }
}
