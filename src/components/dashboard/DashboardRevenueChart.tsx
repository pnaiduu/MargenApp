import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type DailyRevenue = { day: string; revenue: number }

function formatUsd(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

export function DashboardRevenueChart({
  data,
  title = 'Revenue (30 days)',
  valueLabel = 'Revenue',
  emptyMessage = 'No completed revenue in the last 30 days.',
}: {
  data: DailyRevenue[]
  title?: string
  valueLabel?: string
  emptyMessage?: string
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-[#ebebeb] bg-white text-sm text-[#888888]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#ebebeb] bg-white px-6 py-5 transition hover:-translate-y-px hover:border-[#cccccc]">
      <p className="label-caps mb-3">{title}</p>
      <div className="h-[260px] w-full min-h-[260px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#ebebeb" vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#888888', fontSize: 12 }}
              axisLine={{ stroke: '#ebebeb' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatUsd(v)}
              tick={{ fill: '#888888', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #ebebeb',
                borderRadius: 8,
                fontSize: 14,
                color: '#111111',
              }}
              formatter={(value) => {
                const n = typeof value === 'number' ? value : Number(value)
                const safe = Number.isFinite(n) ? n : 0
                return [
                  safe.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }),
                  valueLabel,
                ]
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--margen-accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--margen-accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
