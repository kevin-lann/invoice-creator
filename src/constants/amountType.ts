import type { AmountType } from '../models/AmountType'

interface AmountTypeStyle {
  label: string
  /** Fill for the chart marks. */
  color: string
  /** Muted pill, matching the status badges in the invoice list. */
  badge: string
}

/**
 * Categorical slots 1-4 of the chart palette, in fixed order: colour follows
 * the amount type, never its size, so a filter can never repaint a series.
 * Validated as a set against the white card surface -- aqua and yellow both
 * land under 3:1, which is why every series always carries a visible value
 * beside its swatch.
 */
export const amountTypeStyles: Record<AmountType, AmountTypeStyle> = {
  parts: {
    label: 'Parts',
    color: '#2a78d6',
    badge: 'bg-blue-50 text-blue-900 border-blue-200',
  },
  labour: {
    label: 'Labour',
    color: '#eb6834',
    badge: 'bg-orange-50 text-orange-900 border-orange-200',
  },
  parking: {
    label: 'Parking',
    color: '#1baf7a',
    badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  tax: {
    label: 'HST',
    color: '#eda100',
    badge: 'bg-amber-50 text-amber-900 border-amber-200',
  },
}

/** Chart chrome: hairline, recessive, one step off the white surface. */
export const chartInk = {
  surface: '#ffffff',
  gridline: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  secondary: '#52514e',
}
