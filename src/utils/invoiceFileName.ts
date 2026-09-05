import type { Invoice } from '../models/Invoice'

/** Characters a file name cannot hold on Windows, macOS or Linux. */
const ILLEGAL = /[\\/:*?"<>|]/g

/**
 * What a downloaded invoice is called: its number and the address it was
 * billed to -- the two things the saved-invoice list identifies an invoice by,
 * so a file picked out of a downloads folder reads the same way.
 *
 * Illegal characters are dropped rather than escaped: the name is a label for
 * whoever opens the folder, never something we read back.
 */
export const invoiceFileName = (invoice: Invoice): string => {
  const parts = [invoice.invoiceNo, invoice.customerInfo?.address]
    .map(part => (part ?? '').replace(ILLEGAL, '').trim())
    .filter(Boolean)
  return parts.join('-') || 'invoice'
}
