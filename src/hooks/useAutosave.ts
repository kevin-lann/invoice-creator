import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where the last write got to, for the indicator beside the save button.
 * `saved` carries the clock time it landed, so the line can say when rather
 * than just that it did.
 */
export type AutosaveStatus =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; at: number }
  | { state: 'error' }

export interface AutosaveOptions<T> {
  /** The values as they stand right now. */
  read: () => T
  /** Writes them away. Rejecting puts the indicator into its error state. */
  write: (values: T) => Promise<void>
  /**
   * Whether these values should be written at all. `forced` is true for a
   * save the user asked for by hand, which is the caller's cue to wave
   * through the checks that only exist to keep autosave quiet -- and to keep
   * enforcing the ones that exist to stop a bad write.
   */
  worthSaving?: (values: T, forced: boolean) => boolean
}

export interface Autosave<T> {
  status: AutosaveStatus
  /**
   * Writes, if anything has actually changed. The form's `onBlur` is the main
   * caller -- React's bubbles, so one is enough -- with the controls that
   * change values without moving focus calling it for themselves.
   */
  saveIfChanged: () => void
  /** Writes now even if nothing has changed; for an explicit save button. */
  saveNow: () => void
  /**
   * Records values as already written, without writing them. For the moments
   * the form is filled from somewhere other than the keyboard -- opening a
   * saved invoice, dropping in a file -- so that arriving at values is not
   * mistaken for editing them.
   */
  markSaved: (values: T) => void
}

/**
 * Keeps a form and its store in step, writing on demand and skipping the
 * writes that would change nothing.
 *
 * The trigger is left to the caller -- this hook only answers "write what is
 * in the form now" -- so blur, a timer or a button all arrive down the same
 * path and share one queue, one snapshot and one status line.
 */
export function useAutosave<T>({ read, write, worthSaving }: AutosaveOptions<T>): Autosave<T> {
  const [status, setStatus] = useState<AutosaveStatus>({ state: 'idle' })

  // The three callbacks are held in refs and refreshed on every render, so the
  // handlers below can be built once and still call the current closures. A
  // caller whose `read` closes over this render's state would otherwise have
  // to memoise it just to keep the form's blur handler from being rebuilt.
  const readRef = useRef(read)
  const writeRef = useRef(write)
  const worthSavingRef = useRef(worthSaving)
  readRef.current = read
  writeRef.current = write
  worthSavingRef.current = worthSaving

  /** The values as the store last took them, serialised for comparison. */
  const savedSnapshot = useRef<string | null>(null)

  // A write in flight, and a request that arrived while it was. Blur can fire
  // faster than IndexedDB answers -- tabbing through the fees does it easily
  // -- and letting two writes overlap would race them: on a record that has
  // no id yet, both would find none and file it twice. So a request that
  // arrives mid-write is folded into a single re-run afterwards, which then
  // writes the values as they are by then rather than as they were.
  const writing = useRef(false)
  const requested = useRef(false)
  const requestedForce = useRef(false)

  // Status is component state, so it is left alone once the editor is gone.
  // Re-armed on the way in rather than only on the way out: StrictMode mounts,
  // cleans up and mounts again, and a flag only ever cleared would stay off
  // for the rest of the session.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const flush = useCallback(async (forced: boolean) => {
    requested.current = true
    requestedForce.current = requestedForce.current || forced
    if (writing.current)
      return

    writing.current = true
    try {
      while (requested.current) {
        requested.current = false
        const force = requestedForce.current
        requestedForce.current = false

        const values = readRef.current()
        const snapshot = JSON.stringify(values)
        // Blur fires on the way past a box as much as on the way out of an
        // edit, so most of these have nothing behind them.
        if (!force && snapshot === savedSnapshot.current)
          continue
        if (worthSavingRef.current?.(values, force) === false)
          continue

        if (mounted.current)
          setStatus({ state: 'saving' })
        await writeRef.current(values)
        // Only a write that landed moves the snapshot: one that threw leaves
        // the change looking unsaved, which is what it is, so the next blur
        // tries it again.
        savedSnapshot.current = snapshot
        if (mounted.current)
          setStatus({ state: 'saved', at: Date.now() })
      }
    } catch (error) {
      console.error('Autosave failed', error)
      if (mounted.current)
        setStatus({ state: 'error' })
    } finally {
      writing.current = false
    }
  }, [])

  const saveIfChanged = useCallback(() => { void flush(false) }, [flush])
  const saveNow = useCallback(() => { void flush(true) }, [flush])
  const markSaved = useCallback((values: T) => {
    savedSnapshot.current = JSON.stringify(values)
  }, [])

  return { status, saveIfChanged, saveNow, markSaved }
}
