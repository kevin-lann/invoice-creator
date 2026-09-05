import { useCallback, useEffect, useState } from 'react'
import { ensurePersistentStorage, retryPersistentStorage, type PersistenceResult } from '../db/persistence'

/**
 * Requests persistent storage once when the app mounts and reports the answer.
 */
export function usePersistentStorage() {
  const [result, setResult] = useState<PersistenceResult>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false
    ensurePersistentStorage().then(value => {
      if (!cancelled)
        setResult(value)
    })
    return () => { cancelled = true }
  }, [])

  const retry = useCallback(async () => {
    setResult({ state: 'checking' })
    setResult(await retryPersistentStorage())
  }, [])

  return { ...result, retry }
}
