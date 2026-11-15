import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: import.meta.env.VITE_CURRENCY || 'USD',
})

export default function SalesTrendChart({ data }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6d5ce8" stopOpacity=".22" />
              <stop offset="95%" stopColor="#6d5ce8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#8b90a0', fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8b90a0', fontSize: 11 }} tickFormatter={(value) => `$${value}`} />
          <Tooltip formatter={(value) => currency.format(value)} />
          <Area type="monotone" dataKey="revenue" stroke="#6d5ce8" strokeWidth={2.5} fill="url(#salesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
