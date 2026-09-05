import { Check, Minus } from 'lucide-react'

interface HstToggleProps {
  /** Whether HST is being charged on the line this box sits on. */
  on: boolean
  /**
   * Some but not all of the lines underneath are on. Only the subtotal's box
   * stands for more than one line, so only it can be in this state.
   */
  partial?: boolean
  /** What ticking the box does, on hover and to a screen reader. */
  title: string
  onToggle: () => void
}

/**
 * The box that says whether HST is charged on one line of the invoice.
 *
 * Amber because that is the colour the reports draw HST in, so the ticks here
 * and the tax slice of the chart read as the same thing.
 *
 * Every box carries `no-export`, which strips it out of the PDF: these are
 * controls for whoever is writing the invoice, and the customer's copy shows
 * the tax as the one HST line it has always been.
 */
function HstToggle({ on, partial = false, title, onToggle }: HstToggleProps) {
  const marked = on || partial
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partial ? 'mixed' : on}
      title={title}
      aria-label={title}
      onClick={onToggle}
      className={`no-export shrink-0 w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ${
        marked
          ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
          : 'border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100'
      }`}
    >
      {partial
        ? <Minus size={12} strokeWidth={3} aria-hidden="true" />
        : on ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
    </button>
  )
}

export default HstToggle
