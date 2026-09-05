export type PersistenceState =
  /** The request is still in flight. */
  | 'checking'
  /** The browser promised not to evict our data. */
  | 'persisted'
  /** The browser understood the request and said no. */
  | 'denied'
  /** The browser has no Storage API to ask (or we are not in a secure context). */
  | 'unsupported'

export interface PersistenceResult {
  state: PersistenceState
  /** Bytes this origin is currently using, when the browser reports it. */
  usage?: number
  /** Bytes this origin is allowed to use, when the browser reports it. */
  quota?: number
}

let pending: Promise<PersistenceResult> | undefined

/**
 * Asks the browser to keep the invoice database instead of evicting it when
 * the device runs low on space. Chrome decides silently from site engagement,
 * Firefox prompts, and private windows always refuse.
 *
 * The answer is cached so the request is only made once per page load, no
 * matter how many components ask for it.
 */
export function ensurePersistentStorage(): Promise<PersistenceResult> {
  pending ??= requestPersistence()
  return pending
}

/** Re-asks the browser, for the "Try again" button after a refusal. */
export function retryPersistentStorage(): Promise<PersistenceResult> {
  pending = requestPersistence()
  return pending
}

async function requestPersistence(): Promise<PersistenceResult> {
  const storage = navigator.storage

  if (!storage?.persist || !storage.persisted)
    return { state: 'unsupported' }

  try {
    // Asking again when it is already granted is pointless, and on Firefox it
    // would pop the permission prompt a second time.
    const granted = (await storage.persisted()) || (await storage.persist())
    return { state: granted ? 'persisted' : 'denied', ...(await getEstimate()) }
  } catch (error) {
    console.error('Persistent storage request failed', error)
    return { state: 'unsupported' }
  }
}

async function getEstimate(): Promise<{ usage?: number, quota?: number }> {
  try {
    if (!navigator.storage?.estimate)
      return {}
    const { usage, quota } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return {}
  }
}
