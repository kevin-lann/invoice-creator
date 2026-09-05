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
export const CHARGE_CATEGORIES = ['labour', 'parking', 'other'] as const

export type ChargeCategory = typeof CHARGE_CATEGORIES[number]

export interface Charge {
  /** The field name, on the form and in the database alike. */
  key: string
  /** Printed beside the input in the editor. */
  label: string
  /**
   * For a fee each invoice names for itself: the field holding the name that
   * was typed, with `label` standing in while that box is empty. The reports
   * still file the money under this fee's category, since one invoice's name
   * for it means nothing to a total drawn across hundreds of them.
   */
  nameKey?: string
  /** Which slice of the reports this fee counts towards. */
  category: ChargeCategory
  /**
   * Whether HST was charged on it back before invoices carried their own HST
   * toggles. Nothing is billed on this any more -- it is only how an invoice
   * written back then is read, so that its total stays the figure it was sent
   * out with.
   */
  legacyTaxable: boolean
}

export const CHARGES = [
  {
    key: 'labourFee',
    label: 'Labour and Diagnosis Fee',
    category: 'labour',
    legacyTaxable: true,
  },
  {
    key: 'parkingCost',
    label: 'Parking Cost',
    category: 'parking',
    // Billed at cost, HST already included in the figure.
    legacyTaxable: false,
  },
  {
    key: 'otherFee',
    label: 'Other',
    nameKey: 'otherName',
    category: 'other',
    // Predates nothing: invoices have had their own toggles since this fee
    // existed, so it is never read off this.
    legacyTaxable: false,
  },
] as const satisfies readonly Charge[]

/** The field name of one fee. */
export type ChargeKey = typeof CHARGES[number]['key']

/** The field name holding the name typed for one of the self-named fees. */
export type ChargeNameKey = Extract<typeof CHARGES[number], { nameKey: string }>['nameKey']

/** The fee fields an invoice carries, as the form and the database hold them. */
export type ChargeAmounts = Record<ChargeKey, number>

/** The names typed for the self-named fees, in the same two places. */
export type ChargeNames = Record<ChargeNameKey, string>

/** Which of an invoice's fees HST is charged on top of. */
export type ChargeTaxFlags = Record<ChargeKey, boolean>

/** The HST toggles as the form and the database hold them. */
export interface ChargeTaxes {
  taxedCharges: ChargeTaxFlags
}

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const str = (value: unknown) => (typeof value === 'string' ? value : '')

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

/** One of the fees the invoice names for itself. */
export type NamedCharge = Extract<typeof CHARGES[number], { nameKey: string }>

/** The fees whose names are typed per invoice, in registry order. */
export const NAMED_CHARGES: readonly NamedCharge[] = CHARGES.filter(
  (charge): charge is NamedCharge => 'nameKey' in charge,
)

/** Every self-named fee's name read off `source`, unnamed ones coming back blank. */
export const chargeNames = (
  source: Partial<Record<ChargeNameKey, unknown>> = {},
): ChargeNames =>
  Object.fromEntries(
    NAMED_CHARGES.map(charge => [charge.nameKey, str(source[charge.nameKey])]),
  ) as ChargeNames

/** Every self-named fee unnamed, for a blank invoice. */
export const emptyChargeNames = (): ChargeNames => chargeNames()

const flags = (source: { taxedCharges?: unknown }) =>
  (typeof source.taxedCharges === 'object' && source.taxedCharges !== null
    ? source.taxedCharges
    : {}) as Partial<Record<ChargeKey, unknown>>

/**
 * The HST toggles read off `source`, with anything missing switched off --
 * a fee is taxed only where the invoice says in so many words that it is.
 */
export const chargeTaxFlags = (source: { taxedCharges?: unknown } = {}): ChargeTaxFlags => {
  const taxed = flags(source)
  return Object.fromEntries(
    CHARGES.map(charge => [charge.key, taxed[charge.key] === true]),
  ) as ChargeTaxFlags
}

/** No fee taxed, which is where a fresh invoice starts. */
export const emptyTaxFlags = (): ChargeTaxFlags => chargeTaxFlags()

/** The rule that was in force before invoices carried their own toggles. */
export const legacyTaxFlags = (): ChargeTaxFlags =>
  Object.fromEntries(
    CHARGES.map(charge => [charge.key, charge.legacyTaxable]),
  ) as ChargeTaxFlags

/**
 * The toggles for an invoice read out of the database or a JSON file. One
 * saved before the toggles existed carries none at all, and is read the way it
 * was billed rather than as an invoice with HST switched off, so re-opening it
 * does not quietly knock 13% off a total that has already been sent out.
 */
export const storedChargeTaxFlags = (source: { taxedCharges?: unknown } = {}): ChargeTaxFlags =>
  typeof source.taxedCharges === 'object' && source.taxedCharges !== null
    ? chargeTaxFlags(source)
    : legacyTaxFlags()
