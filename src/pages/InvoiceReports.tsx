import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Table2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import AmountTypeChart from '../components/AmountTypeChart'
import { amountTypeStyles } from '../constants/amountType'
import { invoiceStatusStyles } from '../constants/invoiceStatus'
import { listInvoiceStats } from '../db/invoiceRepository'
import { AMOUNT_TYPES, type AmountType } from '../models/AmountType'
import { INVOICE_STATUSES, type InvoiceStatus } from '../models/Invoice'
import { currencyFormatter } from '../utils/currency'
import {
  REPORT_PERIODS,
  buildReport,
  defaultSelection,
  periodNeighbours,
  periodTitle,
  reportPeriodLabels,
  selectPeriod,
  type ReportPeriod,
  type ReportSelection,
} from '../utils/invoiceStats'

const statusIcons: Record<InvoiceStatus, typeof CheckCircle2> = {
  paid: CheckCircle2,
  unpaid: AlertCircle,
}

const describeCount = (count: number) => `${count} invoice${count === 1 ? '' : 's'}`

/** What a period is called in prose, once the range has picked its width. */
const unitNouns = {
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
} as const

const stepButtonStyle =
  'p-1 rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 ' +
  'disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed'

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function InvoiceReports() {
  // Computed once: which month "this month" is must not change under the
  // reader mid-session.
  const [selection, setSelection] = useState<ReportSelection>(defaultSelection)
  // One status at a time, opening on paid; undefined is no status filter at
  // all -- which is what pressing the selected tile again leaves behind.
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>('paid')
  const [showTable, setShowTable] = useState(false)

  // Re-runs by itself whenever an invoice is saved, imported or deleted.
  const stats = useLiveQuery(() => listInvoiceStats())

  const report = useMemo(
    () => (stats ? buildReport(stats, selection, statusFilter) : undefined),
    [stats, selection, statusFilter],
  )

  // Where the arrows lead; either is undefined when there is nothing that way.
  const neighbours = useMemo(
    () => (stats ? periodNeighbours(stats, selection) : {}),
    [stats, selection],
  )

  const step = (start: number | undefined) =>
    start !== undefined && setSelection(current => ({ ...current, start }))

  /** Names where an arrow leads, or why it is dead. */
  const stepTitle = (start: number | undefined, direction: 'before' | 'after') =>
    start === undefined
      ? `No invoices ${direction} ${periodTitle(selection)}`
      : `Show ${periodTitle({ ...selection, start })}`

  /** Picking a status replaces whatever was picked; picking it again clears it. */
  const toggleStatus = (status: InvoiceStatus) =>
    setStatusFilter(current => (current === status ? undefined : status))

  // "August 2026" / "2024" / "all time" -- always used mid-sentence.
  const periodLabel = periodTitle(selection)
  const statusPhrase = statusFilter && invoiceStatusStyles[statusFilter].label.toLowerCase()

  return (
    <div className="w-full flex flex-col items-center min-h-screen">
      <div className="bg-white shadow-lg rounded-lg p-8 w-[8.5in] max-w-3xl flex flex-col">
        <div className="flex flex-row justify-between items-center pb-4">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Link
            to="/invoices"
            className="text-sm text-slate-600 no-underline hover:text-blue-600"
          >
            All invoices
          </Link>
        </div>

        {/* Both filters sit above everything they scope: the total, the chart
            and both tables always describe the same set of invoices. */}
        <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 justify-between items-center pb-4">
          <div className="flex flex-row flex-wrap gap-2" role="group" aria-label="Period length">
            {REPORT_PERIODS.map((option: ReportPeriod) => (
              <button
                key={option}
                type="button"
                aria-pressed={selection.period === option}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  selection.period === option
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                onClick={() => setSelection(current => selectPeriod(current, option))}
              >
                {reportPeriodLabels[option]}
              </button>
            ))}
          </div>

          {/* "All time" is the one width with nothing either side of it. */}
          {selection.period !== 'all' && (
            <div className="flex flex-row items-center gap-1">
              <button
                type="button"
                className={stepButtonStyle}
                disabled={neighbours.previous === undefined}
                title={stepTitle(neighbours.previous, 'before')}
                aria-label={stepTitle(neighbours.previous, 'before')}
                onClick={() => step(neighbours.previous)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              {/* A fixed width so the label does not shove the arrows around
                  as it steps from "May 2026" to "September 2026". */}
              <span
                className="text-sm font-semibold text-slate-900 text-center min-w-[8.5rem]"
                aria-live="polite"
              >
                {sentenceCase(periodLabel)}
              </span>
              <button
                type="button"
                className={stepButtonStyle}
                disabled={neighbours.next === undefined}
                title={stepTitle(neighbours.next, 'after')}
                aria-label={stepTitle(neighbours.next, 'after')}
                onClick={() => step(neighbours.next)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {report === undefined ? (
          <p className="text-sm text-gray-500 py-8 text-center">Loading reports...</p>
        ) : stats?.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No invoices saved yet.</p>
            <p className="text-sm text-gray-500">
              Save an invoice from the editor and its numbers will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 pb-6" role="group" aria-label="Payment status">
              {INVOICE_STATUSES.map(status => {
                const Icon = statusIcons[status]
                const { total, count } = report.byStatus[status]
                const isOn = statusFilter === status
                const style = invoiceStatusStyles[status]
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={isOn}
                    title={isOn
                      ? `Stop filtering by ${style.label.toLowerCase()}`
                      : `Show only ${style.label.toLowerCase()} invoices`}
                    className={`rounded-lg border p-3 flex flex-col gap-1 text-left transition-opacity ${style.badge} ${
                      isOn
                        ? `ring-2 ring-offset-1 ${style.ring}`
                        : statusPhrase
                          ? 'opacity-50 hover:opacity-100'
                          : 'hover:opacity-75'
                    }`}
                    onClick={() => toggleStatus(status)}
                  >
                    <span className="flex flex-row items-center gap-2 text-sm">
                      <Icon size={16} aria-hidden="true" />
                      <span>{style.label}</span>
                    </span>
                    <span className="text-xl font-semibold text-slate-900">
                      {currencyFormatter.format(total)}
                    </span>
                    <span className="text-xs text-slate-500">{describeCount(count)}</span>
                  </button>
                )
              })}
            </div>

            <div className="pb-8">
              <div className="text-sm text-slate-600 flex flex-row flex-wrap gap-x-2 items-baseline">
                <span>
                  {statusPhrase ? sentenceCase(statusPhrase) : 'Total billed'}, {periodLabel}
                </span>
                {statusPhrase && (
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() => setStatusFilter(undefined)}
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="text-5xl font-semibold text-slate-900 leading-tight">
                {currencyFormatter.format(report.total)}
              </div>
              <div className="text-sm text-slate-500">
                {describeCount(report.invoiceCount)}
              </div>
            </div>

            {report.invoiceCount === 0 ? (
              <div className="border-t border-slate-200 py-12 text-center">
                <p className="text-sm text-gray-500">
                  {statusPhrase
                    ? `No ${statusPhrase} invoices in ${periodLabel}.`
                    : `No invoices dated in ${periodLabel}.`}
                </p>
                <p className="text-sm text-gray-500">
                  Try {statusPhrase ? 'another status, ' : ''}
                  {selection.period === 'all' ? 'a different filter' : 'the arrows, or a wider period'}.
                </p>
              </div>
            ) : (
              <>
                <div className="border-t border-slate-200 pt-6">
                  <h2 className="font-bold text-lg mb-1">What was billed for</h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Each column is one {unitNouns[report.unit]}, split by the kind of charge.
                    Totals are what the customer was billed, HST included -- nothing here
                    records what the parts cost, so this is revenue rather than margin.
                  </p>
                  <AmountTypeChart
                    buckets={report.buckets}
                    scopeLabel={statusPhrase
                      ? `${periodLabel}, ${statusPhrase} invoices only`
                      : periodLabel}
                  />
                </div>

                <table className="w-full text-sm table-fixed mt-6">
                  <caption className="sr-only">
                    Amount billed by charge type, {periodLabel}
                  </caption>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Charge type</th>
                      <th className="border p-2 text-right w-[40%]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AMOUNT_TYPES.map((type: AmountType) => (
                      <tr key={type}>
                        <td className="border p-2">
                          <span className="flex flex-row items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: amountTypeStyles[type].color }}
                            />
                            {amountTypeStyles[type].label}
                          </span>
                        </td>
                        <td className="border p-2 text-right tabular-nums">
                          {currencyFormatter.format(report.amounts[type])}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="border p-2">Total</td>
                      <td className="border p-2 text-right tabular-nums">
                        {currencyFormatter.format(report.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="pt-4">
                  <button
                    type="button"
                    aria-expanded={showTable}
                    className="text-sm text-slate-600 flex flex-row gap-2 items-center hover:text-blue-600"
                    onClick={() => setShowTable(current => !current)}
                  >
                    <Table2 size={16} aria-hidden="true" />
                    {showTable ? 'Hide' : 'Show'} the numbers behind the chart
                  </button>
                </div>

                {showTable && (
                  <table className="w-full text-sm table-fixed mt-3">
                    <caption className="sr-only">
                      Amount billed per {unitNouns[report.unit]}, {periodLabel}
                    </caption>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left w-[22%]">Period</th>
                        {AMOUNT_TYPES.map((type: AmountType) => (
                          <th key={type} className="border p-2 text-right">
                            {amountTypeStyles[type].label}
                          </th>
                        ))}
                        <th className="border p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.buckets.map(bucket => (
                        <tr key={bucket.start}>
                          <td className="border p-2">{bucket.title}</td>
                          {AMOUNT_TYPES.map((type: AmountType) => (
                            <td key={type} className="border p-2 text-right tabular-nums">
                              {currencyFormatter.format(bucket.amounts[type])}
                            </td>
                          ))}
                          <td className="border p-2 text-right tabular-nums font-semibold">
                            {currencyFormatter.format(bucket.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default InvoiceReports
