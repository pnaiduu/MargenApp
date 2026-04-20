import { useState } from 'react'
import { formatUsdFromCents } from '../../lib/formatUsd'
import { supabase } from '../../lib/supabase'

export type MissedCallRow = {
  id: string
  caller_phone: string | null
  occurred_at: string
  estimated_value_cents: number
}

export function MissedCallsPanel({
  rows,
  onUpdated,
}: {
  rows: MissedCallRow[]
  onUpdated: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function callback(row: MissedCallRow) {
    setBusyId(row.id)
    const { error } = await supabase.from('phone_calls').update({ status: 'called_back' }).eq('id', row.id)
    setBusyId(null)
    if (!error) {
      onUpdated()
      if (row.caller_phone) {
        const raw = row.caller_phone.replace(/[^\d+]/g, '')
        const href = raw.startsWith('tel:') ? raw : `tel:${raw}`
        const a = document.createElement('a')
        a.href = href
        a.rel = 'noopener noreferrer'
        a.click()
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white transition hover:-translate-y-px hover:border-[#cccccc]">
      <div className="border-b border-[#ebebeb] px-6 py-4">
        <h2 className="card-title">Missed calls</h2>
        <p className="mt-1 text-xs text-[#888888]">Needs callback</p>
      </div>
      <ul className="divide-y divide-[#ebebeb]">
        {rows.length === 0 ? (
          <li className="px-6 py-6 text-center text-sm text-[#888888]">None right now.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-[#111111]">{row.caller_phone ?? 'Unknown'}</p>
                <p className="mt-1 text-xs text-[#888888]">
                  {new Date(row.occurred_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {row.estimated_value_cents > 0 ? (
                    <span className="ml-2">· est. {formatUsdFromCents(row.estimated_value_cents)}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => void callback(row)}
                className="shrink-0 rounded-md bg-[var(--margen-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--margen-accent-fg)] transition hover:brightness-[0.92] active:scale-[0.99] disabled:opacity-50"
              >
                {busyId === row.id ? '…' : 'Callback'}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
