import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, FilePlus2, SaveAll, Trash2, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import {
  deleteInvoice,
  exportAllInvoices,
  importInvoiceFile,
  listInvoices,
  type InvoiceSummary,
} from '../db/invoiceRepository'
import { readJsonFile, saveJson } from '../utils/jsonConverter'
import { formatDateAsYYYYMMDD } from '../utils/formatDate'
import { currencyFormatter } from '../utils/currency'
import { invoiceStatusSortOrder, invoiceStatusStyles } from '../constants/invoiceStatus'
import { parseInvoiceDate } from '../utils/invoiceDate'

const describeCount = (count: number) => `${count} invoice${count === 1 ? '' : 's'}`

const savedAtFormatter = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** The columns the list can be reordered by. */
type SortKey = 'date' | 'status' | 'address'

type SortDirection = 'asc' | 'desc'

interface Sort {
  key: SortKey
  direction: SortDirection
}

/** The first click on a column sorts it the way that column is most useful. */
const defaultDirection: Record<SortKey, SortDirection> = {
  date: 'desc',
  status: 'asc',
  address: 'asc',
}

/** Spelled out on the header button, since an arrow alone is ambiguous here. */
const sortLabels: Record<SortKey, Record<SortDirection, string>> = {
  date: { desc: 'most recent first', asc: 'oldest first' },
  status: { asc: 'unpaid first', desc: 'paid first' },
  address: { asc: 'address A to Z', desc: 'address Z to A' },
}

/** Ascending comparators; a descending sort negates the result. */
const comparators: Record<SortKey, (a: InvoiceSummary, b: InvoiceSummary) => number> = {
  // Blank dates are filtered out below, so the fallback here never decides an order.
  date: (a, b) => (parseInvoiceDate(a.date) ?? 0) - (parseInvoiceDate(b.date) ?? 0),
  status: (a, b) => invoiceStatusSortOrder[a.status] - invoiceStatusSortOrder[b.status],
  address: (a, b) => a.customerAddress.localeCompare(b.customerAddress, 'en-CA', { sensitivity: 'base' }),
}

/**
 * Rows the sorted column cannot speak for -- no readable date, no billing
 * address. They sit at the bottom whichever way the column points, rather than
 * flipping up to the top and burying the rows that were actually asked for.
 */
const isBlank: Record<SortKey, (invoice: InvoiceSummary) => boolean> = {
  date: invoice => parseInvoiceDate(invoice.date) === undefined,
  status: () => false,
  address: invoice => invoice.customerAddress.trim() === '',
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
  /** The column width, which lives on the `th` for `table-fixed` to read. */
  className?: string
}

/** A column heading that reorders the list when clicked. */
function SortableHeader({ label, sortKey, sort, onSort, className }: SortableHeaderProps) {
  const active = sort.key === sortKey
  const direction = active ? sort.direction : defaultDirection[sortKey]
  const nextDirection: SortDirection = active
    ? (direction === 'asc' ? 'desc' : 'asc')
    : defaultDirection[sortKey]
  const Arrow = direction === 'desc' ? ChevronDown : ChevronUp

  return (
    <th className={`border p-0 text-left ${className ?? ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-1 px-2 py-2 font-bold text-left hover:bg-gray-200"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${sortLabels[sortKey][nextDirection]}`}
      >
        <span>{label}</span>
        <Arrow size={14} className={active ? 'text-blue-600' : 'text-slate-400'} />
      </button>
    </th>
  )
}

function InvoicesList() {
  const navigate = useNavigate()
  // useLiveQuery re-runs whenever any of the three tables change.
  const invoices = useLiveQuery(() => listInvoices())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  // The list opens most recent invoice first; clicking a column takes it from there.
  const [sort, setSort] = useState<Sort>({ key: 'date', direction: 'desc' })

  const handleSort = (key: SortKey) =>
    setSort(current => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: defaultDirection[key] })

  const sortedInvoices = useMemo(() => {
    if (!invoices)
      return invoices

    const sign = sort.direction === 'asc' ? 1 : -1
    const blank = isBlank[sort.key]
    const compare = comparators[sort.key]

    return invoices.slice().sort((a, b) => {
      const aBlank = blank(a)
      const bBlank = blank(b)
      if (aBlank !== bBlank)
        return aBlank ? 1 : -1

      const result = sign * compare(a, b)
      // Same date, status or address: fall back to the default ordering so
      // rows never shuffle between renders.
      return result !== 0 ? result : b.updatedAt - a.updatedAt
    })
  }, [invoices, sort])

  useEffect(() => {
    if (status === null)
      return
    const timeout = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(timeout)
  }, [status])

  /** Writes every saved invoice into a single backup file. */
  const handleSaveAll = async () => {
    try {
      const backup = await exportAllInvoices()
      if (backup.invoices.length === 0) {
        setStatus('There are no invoices to save yet.')
        return
      }
      const filename = `invoices-backup-${formatDateAsYYYYMMDD()}`
      saveJson(backup, filename)
      setStatus(`Saved ${describeCount(backup.invoices.length)} to ${filename}.json`)
    } catch (error) {
      console.error('Failed to export invoices', error)
      setStatus('Could not save the invoices.')
    }
  }

  /** Reads saved invoice files back into the database, one row each. */
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    // Reset so picking the same file twice in a row still fires a change.
    event.target.value = ''
    if (files.length === 0)
      return

    let added = 0
    let replaced = 0
    let skipped = 0
    for (const file of files) {
      try {
        const parsed = await readJsonFile(file)
        if (parsed === null) {
          skipped++
          continue
        }
        const result = await importInvoiceFile(parsed)
        added += result.added
        replaced += result.replaced
        skipped += result.skipped
      } catch (error) {
        console.error('Failed to import file', error)
        skipped++
      }
    }

    const parts: string[] = []
    if (added > 0)
      parts.push(`Added ${describeCount(added)}`)
    if (replaced > 0)
      parts.push(`${parts.length === 0 ? 'Replaced' : 'replaced'} ${describeCount(replaced)}`)
    if (skipped > 0)
      parts.push(`${parts.length === 0 ? 'Skipped' : 'skipped'} ${skipped} unreadable ${skipped === 1 ? 'entry' : 'entries'}`)
    setStatus(parts.length > 0 ? `${parts.join(', ')}.` : 'Nothing to import.')
  }

  const handleDelete = async (event: React.MouseEvent, id: number, label: string) => {
    event.stopPropagation()
    if (!confirm(`Delete invoice ${label}? This cannot be undone.`))
      return
    try {
      await deleteInvoice(id)
    } catch (error) {
      console.error('Failed to delete invoice', error)
      alert('Could not delete this invoice.')
    }
  }

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      <div className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-2xl flex flex-col">
        <div className="flex flex-row justify-between items-center pb-4">
          <h1 className="text-2xl font-bold">Saved Invoices</h1>
          <div className="flex flex-row gap-2 items-center">
            <input
              type="file"
              accept="application/json"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button
              type="button"
              title="Save every invoice to one backup file"
              className="bg-white border border-slate-300 text-slate-700 text-sm p-3 rounded-md flex gap-2 items-center hover:bg-slate-100 hover:shadow-lg active:scale-[.8] disabled:opacity-50 disabled:hover:bg-white disabled:active:scale-100"
              onClick={handleSaveAll}
              disabled={!invoices || invoices.length === 0}
            >
              <SaveAll size={20} />
              <span>Save all</span>
            </button>
            <button
              type="button"
              title="Upload saved invoice or backup files"
              className="bg-white border border-slate-300 text-slate-700 text-sm p-3 rounded-md flex gap-2 items-center hover:bg-slate-100 hover:shadow-lg active:scale-[.8]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} />
              <span>Upload</span>
            </button>
            <Link
              to="/"
              className="bg-blue-600 text-white text-sm p-3 rounded-md flex gap-2 items-center no-underline hover:bg-blue-500 hover:shadow-xl active:scale-[.8]"
            >
              <FilePlus2 size={20} />
              <span>New</span>
            </Link>
          </div>
        </div>

        {status && (
          <div className="text-sm text-slate-600 bg-slate-100 rounded-md px-3 py-2 mb-3">{status}</div>
        )}

        {invoices === undefined ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No invoices saved yet.</p>
            <p className="text-sm text-gray-500">
              Create one and hit <span className="font-bold">Save</span> in the editor,
              or <span className="font-bold">Upload</span> a backup file to restore.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left w-[17%]">Invoice #</th>
                <SortableHeader label="Date" sortKey="date" sort={sort} onSort={handleSort} className="w-[16%]" />
                <SortableHeader label="Address" sortKey="address" sort={sort} onSort={handleSort} className="w-[27%]" />
                <SortableHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} className="w-[14%]" />
                <th className="border p-2 text-right w-[16%]" title="Total billed, HST included">Total</th>
                <th className="border p-2 w-[46px]"></th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices?.map(invoice => (
                <tr
                  key={invoice.id}
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  title={`Last saved ${savedAtFormatter.format(invoice.updatedAt)}\nid ${invoice.uuid}`}
                >
                  <td className="border p-2">{invoice.invoiceNo || '--'}</td>
                  <td className="border p-2">{invoice.date || '--'}</td>
                  <td className="border p-2">
                    <div>{invoice.customerAddress || 'No address'}</div>
                    <div className="text-xs text-gray-500">{invoice.customerCity}</div>
                  </td>
                  <td className="border p-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${invoiceStatusStyles[invoice.status].badge}`}>
                      {invoiceStatusStyles[invoice.status].label}
                    </span>
                  </td>
                  <td className="border p-2 text-right">
                    <div>{currencyFormatter.format(invoice.total)}</div>
                    <div className="text-xs text-gray-500">
                      {invoice.itemCount} item{invoice.itemCount === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td className="border p-2">
                    <div className="flex flex-row justify-center items-center">
                      <button
                        type="button"
                        title="Delete invoice"
                        className="text-gray-500 hover:text-red-500"
                        onClick={event => handleDelete(event, invoice.id, invoice.invoiceNo || String(invoice.id))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default InvoicesList
