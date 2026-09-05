import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { usePersistentStorage } from '../hooks/usePersistentStorage'

const formatBytes = (bytes: number) => {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

/**
 * Saved invoices only live in this browser, so tell the user when the browser
 * has not promised to keep them.
 */
function StorageWarning() {
  const { state, usage, quota, retry } = usePersistentStorage()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || state === 'checking' || state === 'persisted')
    return null

  const usageLabel = usage !== undefined && quota !== undefined
    ? `Currently using ${formatBytes(usage)} of about ${formatBytes(quota)} available.`
    : undefined

  return (
    <div
      role="alert"
      className="w-[8.5in] max-w-2xl mb-4 flex flex-row gap-3 items-start bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-4"
    >
      <div className="pt-[2px]"><AlertTriangle size={20} /></div>
      <div className="text-sm flex flex-col gap-1 flex-1">
        <div className="font-bold">Saved invoices could be cleared by your browser</div>
        <div>
          {state === 'denied'
            ? 'This browser would not grant persistent storage'
            : 'This browser cannot guarantee persistent storage'}
          , so invoices saved here may be deleted automatically if the device runs
          low on space, in a private window, or when you clear browsing data.
          Keep JSON backups of anything important with the <span className="font-bold">save</span> icons,
          and upload them again from the invoice list to restore.
        </div>
        {usageLabel && <div className="text-xs text-amber-700">{usageLabel}</div>}
        {state === 'denied' && (
          <div>
            <button
              type="button"
              className="mt-1 text-sm underline hover:no-underline"
              onClick={() => retry()}
            >
              Try again
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        title="Dismiss"
        className="text-amber-700 hover:text-amber-900"
        onClick={() => setDismissed(true)}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default StorageWarning
