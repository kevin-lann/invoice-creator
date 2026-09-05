import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { UnpaidCustomerInvoice } from '../db/invoiceRepository'
import { currencyFormatter } from '../utils/currency'

interface UnpaidCustomerWarningProps {
  /** The unpaid invoices already saved for whoever this invoice bills. */
  invoices: UnpaidCustomerInvoice[]
}

/**
 * Warns, beside "Bill To", that the customer being billed already owes money
 * on invoices saved here, and lists them when clicked.
 *
 * Two things keep it out of the invoice itself. It is marked `no-export`, which
 * the PDF converter strips: it is a note to whoever is writing the invoice, not
 * something the customer should be handed. And the list opens over the page
 * rather than pushing it down, because the export measures the height of the
 * live page before it strips anything.
 */
function UnpaidCustomerWarning({ invoices }: UnpaidCustomerWarningProps) {
  const [open, setOpen] = useState(false)

  // Typing on into a customer with nothing outstanding leaves no list to show.
  useEffect(() => {
    if (invoices.length === 0)
      setOpen(false)
  }, [invoices.length])

  if (invoices.length === 0)
    return null

  const label = `${invoices.length} unpaid invoice${invoices.length === 1 ? '' : 's'}`

  return (
    <div className="no-export relative">
      <button
        type="button"
        aria-expanded={open}
        title={`This customer has ${label} on file. Click to see ${invoices.length === 1 ? 'it' : 'them'}.`}
        className="flex flex-row gap-1 items-center text-xs px-2 py-1 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-400 hover:bg-yellow-200"
        onClick={() => setOpen(current => !current)}
      >
        <AlertTriangle size={14} />
        <span className="font-bold">{label}</span>
      </button>

      {open && (
        <div
          className="absolute z-10 top-full left-0 mt-1 w-72 bg-white border border-yellow-400 rounded-md shadow-lg p-2 flex flex-col gap-1"
        >
          <div className="text-xs text-slate-600 px-1 pb-1">
            Already unpaid for this name, address and city:
          </div>
          {invoices.map(invoice => (
            <Link
              key={invoice.id}
              to={`/invoices/${invoice.id}`}
              // A new tab, so opening an old invoice cannot discard whatever
              // has been typed into this one but not saved yet.
              target="_blank"
              rel="noreferrer"
              className="flex flex-row justify-between gap-2 text-sm no-underline text-slate-700 rounded px-1 py-1 hover:bg-slate-100"
            >
              <span>{invoice.invoiceNo || 'No number'}</span>
              <span className="text-xs text-slate-500 flex-1">{invoice.date}</span>
              <span>{currencyFormatter.format(invoice.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default UnpaidCustomerWarning
