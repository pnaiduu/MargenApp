/** PostgREST / auth requests that hang longer than this show as timeout errors instead of loading forever. */
export const QUERY_TIMEOUT_MS = 10_000

function mergeAbortSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b
  const c = new AbortController()
  const forward = (sig: AbortSignal) => {
    if (sig.aborted) {
      c.abort(sig.reason)
      return
    }
    sig.addEventListener('abort', () => c.abort(sig.reason), { once: true })
  }
  forward(a)
  forward(b)
  return c.signal
}

/** Drop-in `fetch` for Supabase `global.fetch` — enforces wall-clock timeout and composes with caller `signal`. */
export function fetchWithQueryTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const t = new AbortController()
  const timer = setTimeout(() => {
    t.abort(new DOMException(`Request exceeded ${QUERY_TIMEOUT_MS}ms`, 'TimeoutError'))
  }, QUERY_TIMEOUT_MS)
  const signal = init?.signal ? mergeAbortSignals(init.signal, t.signal) : t.signal
  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer))
}
