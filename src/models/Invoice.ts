import {
  emptyChargeNames,
  emptyCharges,
  emptyTaxFlags,
  type ChargeAmounts,
  type ChargeNames,
  type ChargeTaxes,
} from './charges'

export const getCurrentDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const INVOICE_STATUSES = ['paid', 'unpaid'] as const

/** Where an invoice stands with the customer. */
export type InvoiceStatus = typeof INVOICE_STATUSES[number]

/** A freshly written invoice has not been paid yet. */
export const DEFAULT_INVOICE_STATUS: InvoiceStatus = 'unpaid'

export const isInvoiceStatus = (value: unknown): value is InvoiceStatus =>
  INVOICE_STATUSES.includes(value as InvoiceStatus)

export type Invoice = {
  /**
   * Stable, globally unique identity for this invoice, assigned on first save.
   * Optional because invoices typed into the editor (and files exported before
   * ids existed) do not have one until they are saved.
   */
  uuid?: string,
  /** Payment status; absent on invoices saved before statuses existed. */
  status?: InvoiceStatus,
  invoiceNo: string,
  date: string,
  customerInfo: {
    name?: string,
    address: string,
    city: string,
    phone?: string,
    email?: string,
  }
  description: string,
  recommendation: string,
  items: {
    id: number
    name: string,
    quantity?: number,
    unitPrice?: number,
    amount: number,
    /** Whether HST is charged on this line. Off unless it is switched on. */
    taxable: boolean,
  }[],
} & ChargeAmounts & ChargeNames & ChargeTaxes

/**
 * Whether a line item out of the database or a JSON file is taxed. One written
 * before the per-item toggles existed carries no flag of its own, and back
 * then HST was charged on the whole subtotal -- so it reads as taxed, and an
 * old invoice re-opened still totals what it was sent out for.
 */
export const storedItemTaxable = (taxable: unknown): boolean =>
  typeof taxable === 'boolean' ? taxable : true

export const baseInvoice: Invoice = {
  status: DEFAULT_INVOICE_STATUS,
  invoiceNo: getCurrentDate(),
  date: new Date().toDateString().slice(4),
  customerInfo: {
    name: "John Doe",
    address: "42 Jump st.",
    city: "Toronto",
    phone: "123 456 7890",
    email: "johndoe@gmail.com",
  },
  description: "Malfuctioning microwave, Broken fridge light",
  recommendation: "Purchase replacement part xyz at partscanada.ca",
  items: [
    {
      id: 0,
      name: "Aluminum duct tape",
      quantity: 1,
      unitPrice: 5.00,
      amount: 5.00,
      taxable: false,
    },
    {
      id: 1,
      name: "Lightbulb",
      quantity: 2,
      unitPrice: 8.00,
      amount: 16.00,
      taxable: false,
    },
    {
      id: 2,
      name: "Screws",
      quantity: 30,
      unitPrice: 0.60,
      amount: 18.00,
      taxable: false,
    },
    {
      id: 3,
      name: "Labor",
      amount: 200.00,
      taxable: false,
    }
  ],
  ...emptyCharges(),
  ...emptyChargeNames(),
  // A new invoice charges HST on nothing until it is told to.
  taxedCharges: emptyTaxFlags(),
}