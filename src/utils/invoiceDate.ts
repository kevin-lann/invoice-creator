/**
 * Reading and bucketing the dates invoices actually carry.
 *
 * The editor writes `date` straight out of an `<input type="date">`, so it is
 * `YYYY-MM-DD` -- but invoices saved before that field became a date picker,
 * and the sample invoice, hold the `toDateString()` form (`Aug 24 2026`).
 * Reports have to read both.
 */

/** Milliseconds at local midnight on the invoice's date, or undefined. */
export function parseInvoiceDate(date: string | undefined): number | undefined {
  const trimmed = date?.trim()
  if (!trimmed)
    return undefined

  // Split YYYY-MM-DD by hand: `new Date('2026-08-24')` is read as UTC, which
  // lands on the previous day for anyone west of Greenwich.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (iso)
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime()

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** How wide one column of the timeline is. */
export type BucketUnit = 'day' | 'week' | 'month' | 'year'

export const startOfDay = (ms: number) => {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Weeks start on Monday. */
export const startOfWeek = (ms: number) => {
  const date = new Date(startOfDay(ms))
  // getDay() is 0 on Sunday, which belongs to the week that began six days ago.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date.getTime()
}

export const startOfMonth = (ms: number) => {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

export const startOfYear = (ms: number) => new Date(new Date(ms).getFullYear(), 0, 1).getTime()

/** Snaps a moment back to the start of the bucket that contains it. */
export function startOfBucket(ms: number, unit: BucketUnit): number {
  switch (unit) {
    case 'day': return startOfDay(ms)
    case 'week': return startOfWeek(ms)
    case 'month': return startOfMonth(ms)
    case 'year': return startOfYear(ms)
  }
}

/**
 * Steps a bucket start forward (or back, for a negative `count`) by whole
 * units. Done on a Date rather than by adding milliseconds so it survives
 * months of different lengths and daylight saving.
 */
export function addUnits(ms: number, unit: BucketUnit, count: number): number {
  const date = new Date(ms)
  switch (unit) {
    case 'day': date.setDate(date.getDate() + count); break
    case 'week': date.setDate(date.getDate() + count * 7); break
    case 'month': date.setMonth(date.getMonth() + count); break
    case 'year': date.setFullYear(date.getFullYear() + count); break
  }
  return date.getTime()
}

const dayLabel = new Intl.DateTimeFormat('en-CA', { weekday: 'short' })
const dateLabel = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' })
const monthLabel = new Intl.DateTimeFormat('en-CA', { month: 'short' })
const fullDateLabel = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' })

/**
 * The short label under a column on the axis.
 *
 * `longSpan` says the axis runs further than one turn of the unit's own cycle,
 * where the plain label stops identifying its column: a month of days cannot
 * be labelled with weekday names, because "Mon" comes round four or five
 * times, and a span crossing new year cannot use bare month names, because a
 * fourteen month span would read "Aug ... Aug" and look like one month twice.
 */
export function bucketLabel(ms: number, unit: BucketUnit, longSpan = false): string {
  switch (unit) {
    case 'day': return longSpan ? String(new Date(ms).getDate()) : dayLabel.format(ms)
    case 'week': return dateLabel.format(ms)
    case 'month': return longSpan
      ? `${monthLabel.format(ms)} '${String(new Date(ms).getFullYear()).slice(2)}`
      : monthLabel.format(ms)
    case 'year': return String(new Date(ms).getFullYear())
  }
}

/** The unambiguous label a tooltip shows, where there is room to spell it out. */
export function bucketTitle(ms: number, unit: BucketUnit): string {
  switch (unit) {
    case 'day': return fullDateLabel.format(ms)
    case 'week': return `Week of ${fullDateLabel.format(ms)}`
    case 'month': return new Date(ms).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    case 'year': return String(new Date(ms).getFullYear())
  }
}
