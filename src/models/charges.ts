/**
 * The flat fees an invoice bills on top of its line items.
 *
 * This list is the single source of truth for them: the invoice type, the
 * stored record, the editor's inputs and the report categories are all derived
 * from it, so adding a fee here adds it everywhere. Two things a new fee still
 * needs, both deliberately: a colour in `constants/amountType.ts`, which the
 * compiler will ask for, and a migration in `db/db.ts`, which has to stay
 * explicit because old databases are upgraded by replaying those in order.
 */

/**
 * The report slot each fee's money lands in, bottom to top as the chart stacks
 * them. Declared here rather than beside the colours so that nothing this
 * registry needs has to import back out of it.
 */
export const CHARGE_CATEGORIES = ['labour', 'parking'] as const

export type ChargeCategory = typeof CHARGE_CATEGORIES[number]

export interface Charge {
  /** The field name, on the form and in the database alike. */
  key: string
  /** Printed beside the input in the editor. */
  label: string
  /** Which slice of the reports this fee counts towards. */
  category: ChargeCategory
  /**
   * Whether HST is charged on top of it. False for anything passed through at
   * what it cost, with its own tax already inside the figure.
   */
  taxable: boolean
}

export const CHARGES = [
  {
    key: 'labourFee',
    label: 'Labour and Diagnosis Fee',
    category: 'labour',
    taxable: true,
  },
  {
    key: 'parkingCost',
    label: 'Parking Cost',
    category: 'parking',
    // Billed at cost, HST already included in the figure.
    taxable: false,
  },
] as const satisfies readonly Charge[]

/** The field name of one fee. */
export type ChargeKey = typeof CHARGES[number]['key']

/** The fee fields an invoice carries, as the form and the database hold them. */
export type ChargeAmounts = Record<ChargeKey, number>

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/**
 * Every fee read off `source`, with anything missing or unreadable landing at
 * zero. One helper for the form, the stored rows and uploaded JSON alike, so
 * none of the three can quietly forget a fee the registry has gained.
 */
export const chargeAmounts = (
  source: Partial<Record<ChargeKey, unknown>> = {},
): ChargeAmounts =>
  Object.fromEntries(
    CHARGES.map(charge => [charge.key, num(source[charge.key])]),
  ) as ChargeAmounts

/** Every fee at zero, for a blank invoice. */
export const emptyCharges = (): ChargeAmounts => chargeAmounts()
