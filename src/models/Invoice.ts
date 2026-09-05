import { emptyCharges, type ChargeAmounts } from './charges'

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
  }[],
} & ChargeAmounts

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
    },
    {
      id: 1,
      name: "Lightbulb",
      quantity: 2,
      unitPrice: 8.00,
      amount: 16.00,
    },
    {
      id: 2,
      name: "Screws",
      quantity: 30,
      unitPrice: 0.60,
      amount: 18.00,
    },
    {
      id: 3,
      name: "Labor",
      amount: 200.00,
    }
  ],
  ...emptyCharges(),
}