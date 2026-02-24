import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useHourlyForecast } from '../hooks/useHourlyForecast'
import { windRating }        from '../types'
import type { Spot, WindModel, HourForecast } from '../types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Tooltip ───────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}:{' '}
          <strong>
            {p.value}
            {p.name === 'Rain' ? 'mm' : p.name === 'Temp' ? '°C' : ' kts'}
          </strong>
        </div>
      ))}
    </div>
  )
}

// ── Best kite window ──────────────────────────────────────────────────────────
function BestWindow({ data }: { data: HourForecast[] }) {
  let best: { start: number; end: number } | null = null
  let cur:  { start: number; end: number } | null = null

  data.forEach((d, i) => {
    if (windRating(d.wind) === 'good') {
      if (!cur) cur = { start: i, end: i }
      else cur.end = i
    } else {
      if (cur && (!best || cur.end - cur.start > best.end - best.start)) best = cur
      cur = null
    }
  })
  if (cur && (!best || cur.end - cur.start > best.end - best.start)) best = cur
  if (!best) return null

  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <div className="best-window">
      <span className="best-window-icon">🪁</span>
      <div>
        <div className="best-window-title">Best kite window</div>
        <div className="best-window-detail">
          {fmt(best.start)} – {fmt(Math.min(best.end + 1, 23))}
          &nbsp;·&nbsp;
          {best.end - best.start + 1}h of ideal wind
        </div>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode
}) {
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">{title}</span>
        {sub && <span className="section-sub">{sub}</span>}
      </div>
      {children}
    </div>
  )
}

// ── HourlyPanel ───────────────────────────────────────────────────────────────
interface Props {
  spot:      Spot
  model:     WindModel
  dayOffset: number
  onClose:   () => void
}

export function HourlyPanel({ spot, model, dayOffset, onClose }: Props) {
  const { data, loading, error } = useHourlyForecast(
    spot.lat, spot.lng, model, dayOffset
  )
  const isBlend   = model === 'BLEND'
  const windColor = isBlend ? '#6366F1' : '#2563EB'
  const day       = DAYS[dayOffset % 7]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <button className="modal-back" onClick={onClose}>←</button>
          <div>
            <div className="modal-title">{day} · Hourly forecast</div>
            <div className="modal-subtitle">
              {spot.name}&nbsp;·&nbsp;
              <span style={{ color: windColor, fontWeight: 600 }}>
                {isBlend ? '⊕ BLEND' : model}
              </span>
            </div>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="modal-loading">Loading hourly data…</div>
        ) : (
          <>
            {/* Wind */}
            <Section title="Wind Speed" sub="knots · hourly">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hWindGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={windColor} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={windColor} stopOpacity={0}    />
                    </linearGradient>
                    {isBlend && (
                      <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366F1" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
                      </linearGradient>
                    )}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8A96A8' }}
                    axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {isBlend && data[0]?.spread != null && (
                    <Area type="monotone" dataKey="spread" stroke="none"
                      fill="url(#spreadGrad)" legendType="none" dot={false} />
                  )}
                  <Area type="monotone" dataKey="gust" stroke="#93C5FD" strokeWidth={1.5}
                    fill="none" name="Gust" dot={false} strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="wind" stroke={windColor} strokeWidth={2.5}
                    fill="url(#hWindGrad)" name="Wind" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>

            {/* Temp + Rain */}
            <div className="two-col">
              <Section title="Temperature" sub="°C · hourly">
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={data} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8A96A8' }}
                      axisLine={false} tickLine={false} interval={5} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="temp" stroke="#F97316"
                      strokeWidth={2.5} dot={false} name="Temp" />
                  </LineChart>
                </ResponsiveContainer>
              </Section>

              <Section title="Precipitation" sub="mm · hourly">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={data} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8A96A8' }}
                      axisLine={false} tickLine={false} interval={5} />
                    <YAxis tick={{ fontSize: 10, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="rain" fill="#38BDF8" radius={[3, 3, 0, 0]} name="Rain" />
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>

            <BestWindow data={data} />
          </>
        )}
      </div>
    </div>
  )
}
