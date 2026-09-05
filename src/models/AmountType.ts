import type { Invoice } from './Invoice'
import {
  CHARGES,
  CHARGE_CATEGORIES,
  chargeAmounts,
  chargeTaxFlags,
  type ChargeAmounts,
  type ChargeCategory,
} from './charges'

/**
 * The kinds of money an invoice bills for: its line items, one slot per fee in
 * the charge registry, and the tax on top. Reports split totals along these, so
 * they have to cover every field that contributes to a total -- taking the
 * middle of the list from `CHARGE_CATEGORIES` is what keeps that true when a
 * fee is added. The order is the order the chart stacks them in.
 */
export const AMOUNT_TYPES = ['parts', ...CHARGE_CATEGORIES, 'tax'] as const

export type AmountType = typeof AMOUNT_TYPES[number]

export type AmountBreakdown = Record<AmountType, number>

/** The rate charged on whichever lines of an invoice are marked for HST. */
export const HST_RATE = 0.13

/**
 * Where a line item named like labour is counted. Spelled out rather than
 * assumed, so dropping the labour fee from the registry is a compile error
 * here rather than items quietly piling up in a category that no longer exists.
 */
const LABOUR_CATEGORY: ChargeCategory = 'labour'

export const emptyBreakdown = (): AmountBreakdown =>
  Object.fromEntries(AMOUNT_TYPES.map(type => [type, 0])) as AmountBreakdown

export const breakdownTotal = (breakdown: AmountBreakdown) =>
  AMOUNT_TYPES.reduce((sum, type) => sum + breakdown[type], 0)

/** Adds `addend` into `target`, in place. */
export const addBreakdown = (target: AmountBreakdown, addend: AmountBreakdown) => {
  for (const type of AMOUNT_TYPES)
    target[type] += addend[type]
}

/**
 * Line items sit under a "Materials and Parts" heading, so they count as parts
 * -- except that nothing stops people typing labour straight into that table
 * instead of using the labour fee field, and plenty of invoices do exactly
 * that. Names that read as labour are moved across so the split stays honest.
 *
 * `\b` in front of `labou?r` keeps words like "collaborate" out of it.
 */
const LABOUR_ITEM = /\blabou?r|\bservice call|\bdiagnos/i

export const isLabourItem = (name: string | undefined) => LABOUR_ITEM.test(name ?? '')

const num = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/**
 * How one invoice's money splits across the amount types. This is the only
 * place the arithmetic lives: the editor's totals block, the invoice list and
 * the reports all read their figures out of it, so none of the three can drift
 * away from the other two.
 */
export function breakdownOf(
  invoice: {
    items?: (Pick<Invoice['items'][number], 'name' | 'amount'> &
      Partial<Pick<Invoice['items'][number], 'taxable'>>)[]
  } & Partial<ChargeAmounts> & { taxedCharges?: unknown },
): AmountBreakdown {
  const breakdown = emptyBreakdown()

  // What HST is charged on is the invoice's own answer, line by line, rather
  // than a rule about kinds of money: nothing is taxed unless it is ticked.
  let taxable = 0

  for (const item of invoice.items ?? []) {
    const amount = num(item.amount)
    if (isLabourItem(item.name))
      breakdown[LABOUR_CATEGORY] += amount
    else
      breakdown.parts += amount
    // The tick follows the line it was put on, not the slice the reports file
    // that line under: an item named like labour is counted as labour above,
    // and is still one of the items the subtotal's tick covers.
    if (item.taxable === true)
      taxable += amount
  }

  const charges = chargeAmounts(invoice)
  const taxed = chargeTaxFlags(invoice)
  for (const charge of CHARGES) {
    breakdown[charge.category] += charges[charge.key]
    if (taxed[charge.key])
      taxable += charges[charge.key]
  }

  breakdown.tax = taxable * HST_RATE

  return breakdown
}
