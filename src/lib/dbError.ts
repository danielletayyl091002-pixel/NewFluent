type ErrorHandler = (message: string) => void
let globalHandler: ErrorHandler | null = null

export function registerErrorHandler(fn: ErrorHandler) {
  globalHandler = fn
}

export function reportDbError(message: string) {
  if (globalHandler) globalHandler(message)
  else console.error('[Dexie error]', message)
}

export async function safeDbWrite<T>(
  fn: () => Promise<T>,
  errorMessage = 'Failed to save. Please try again.'
): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(err)
    reportDbError(errorMessage)
    return null
  }
}
