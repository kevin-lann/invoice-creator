import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_INVOICE_STATUS, isInvoiceStatus, type InvoiceStatus } from '../models/Invoice';
import type { ChargeAmounts } from '../models/charges';

/**
 * Customer info, stored once per customer and referenced by invoices.
 */
export interface CustomerRecord {
  id: number;
  name?: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
}

/**
 * The invoice header. Line items live in the `items` table and the billing
 * details live in `customers`, both linked back by foreign key; the fee columns
 * come from the charge registry, so a fee added there is a column here too.
 */
export type InvoiceRecord = {
  id: number;
  /**
   * The invoice's identity outside this browser. `id` is only unique within
   * one device's database, so exports and imports are matched on this instead.
   */
  uuid: string;
  /** Payment status: paid or unpaid. */
  status: InvoiceStatus;
  invoiceNo: string;
  date: string;
  /** FK -> customers.id */
  customerId: number;
  description: string;
  recommendation: string;
  createdAt: number;
  updatedAt: number;
} & ChargeAmounts;

/**
 * The two free-text "other" fees invoices carried before v4. Declared only so
 * the upgrade below can read them off the rows it is rewriting.
 */
interface LegacyOtherFees {
  other1?: string;
  other1Fee?: number;
  other2?: string;
  other2Fee?: number;
}

/**
 * A single line item belonging to one invoice.
 */
export interface ItemRecord {
  id: number;
  /** FK -> invoices.id */
  invoiceId: number;
  /** Position of the item within its invoice. */
  sortOrder: number;
  name: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}

const feeAmount = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const db = new Dexie('InvoiceCreatorDB') as Dexie & {
  customers: EntityTable<CustomerRecord, 'id'>;
  invoices: EntityTable<InvoiceRecord, 'id'>;
  items: EntityTable<ItemRecord, 'id'>;
};

/** A new globally unique invoice identity. */
export function createInvoiceUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();

  // randomUUID needs a secure context; fall back to raw random bytes.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Indexes on the foreign keys are what make the relational lookups cheap.
db.version(1).stores({
  customers: '++id, name, city, phone, email',
  invoices: '++id, invoiceNo, date, customerId, updatedAt',
  items: '++id, invoiceId, name',
});

// v2 gives every invoice a portable unique id. `&uuid` is a unique index;
// rows saved under v1 are backfilled here.
db.version(2).stores({
  customers: '++id, name, city, phone, email',
  invoices: '++id, &uuid, invoiceNo, date, customerId, updatedAt',
  items: '++id, invoiceId, name',
}).upgrade(tx => tx.table<InvoiceRecord>('invoices').toCollection().modify(invoice => {
  if (!invoice.uuid)
    invoice.uuid = createInvoiceUuid();
}));

// v3 adds the payment status; invoices saved before it default to unpaid.
db.version(3).stores({
  customers: '++id, name, city, phone, email',
  invoices: '++id, &uuid, status, invoiceNo, date, customerId, updatedAt',
  items: '++id, invoiceId, name',
}).upgrade(tx => tx.table<InvoiceRecord>('invoices').toCollection().modify(invoice => {
  if (!invoice.status)
    invoice.status = DEFAULT_INVOICE_STATUS;
}));

// v4 replaces the two "other" fees with a parking cost. Whatever was billed as
// an other fee is folded into it rather than dropped, so an upgraded invoice
// still totals what it did before -- HST aside, which every invoice now carries.
db.version(4).stores({
  customers: '++id, name, city, phone, email',
  invoices: '++id, &uuid, status, invoiceNo, date, customerId, updatedAt',
  items: '++id, invoiceId, name',
}).upgrade(tx => tx.table<InvoiceRecord & LegacyOtherFees>('invoices').toCollection().modify(invoice => {
  invoice.parkingCost = feeAmount(invoice.other1Fee) + feeAmount(invoice.other2Fee);
  delete invoice.other1;
  delete invoice.other1Fee;
  delete invoice.other2;
  delete invoice.other2Fee;
}));

// v5 drops the pending status. An invoice that was left pending is money still
// owed, so it becomes unpaid rather than paid -- the same reading v3 gave the
// invoices that predated statuses entirely.
db.version(5).stores({
  customers: '++id, name, city, phone, email',
  invoices: '++id, &uuid, status, invoiceNo, date, customerId, updatedAt',
  items: '++id, invoiceId, name',
}).upgrade(tx => tx.table<InvoiceRecord>('invoices').toCollection().modify(invoice => {
  if (!isInvoiceStatus(invoice.status))
    invoice.status = DEFAULT_INVOICE_STATUS;
}));

export { db };
