import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useForecast }                       from '../hooks/useForecast'
import { ModelComparison }                   from './ModelComparison'
import { windRating, ratingColor }           from '../types'
import type { Spot, WindModel, DayForecast } from '../types'

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

// ── Wind arrow ────────────────────────────────────────────────────────────────
function WindArrow({ deg, size = 18 }: { deg: number; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      style={{ transform: `rotate(${deg}deg)`, display: 'inline-block' }}
    >
      <path d="M12 2 L8 18 L12 14 L16 18 Z" fill="#2563EB" />
    </svg>
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

// ── Tide chart ────────────────────────────────────────────────────────────────
function TideChart({ data }: { data: DayForecast[] }) {
  const pts = data.flatMap((d, i) =>
    Array.from({ length: 24 }, (_, h) => ({
      label: h === 0 ? d.day : '',
      level: +(2 + d.tideRange * Math.sin((h / 24) * Math.PI * 2 + i * 0.5)).toFixed(2),
    }))
  )
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={pts} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
        <defs>
          <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A96A8' }} axisLine={false} tickLine={false} interval={11} />
        <YAxis tick={{ fontSize: 10, fill: '#8A96A8' }} axisLine={false} tickLine={false} domain={[0, 4]} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="level" stroke="#10B981" strokeWidth={2} fill="url(#tideGrad)" name="Tide" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({ d, isBlend, onClick }: {
  d: DayForecast; isBlend: boolean; onClick: () => void
}) {
  const color = ratingColor(windRating(d.wind))
  return (
    <div
      className="day-card"
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = isBlend ? '#6366F1' : '#2563EB'
        el.style.transform   = 'translateY(-2px)'
        el.style.boxShadow   = '0 4px 12px rgba(0,0,0,.10)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = '#E8EDF3'
        el.style.transform   = 'translateY(0)'
        el.style.boxShadow   = '0 1px 4px rgba(0,0,0,.04)'
      }}
    >
      <div className="day-card-label">{d.day}</div>
      <WindArrow deg={d.dirDeg} size={20} />
      <div className="day-card-wind" style={{ color }}>{d.wind}</div>
      <div className="day-card-unit">kts</div>
      <div className="day-card-gust">↑{d.gust}</div>
      {isBlend && d.spread != null && (
        <div className="day-card-spread">±{Math.round(d.spread / 2)}</div>
      )}
      <div className="day-card-hint">tap for hours</div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonBar({ h = 180 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 8 }} />
}

// ── My spots map view ─────────────────────────────────────────────────────────
function MyMapView({ spots, selectedId, onSpotClick }: {
  spots:       Spot[]
  selectedId:  string
  onSpotClick: (id: string) => void
}) {
  return (
    <div className="map-placeholder">
      {spots.map(spot => {
        const xPct  = ((spot.lng + 180) / 360) * 100
        const yPct  = ((90 - spot.lat)  / 180) * 100
        const isSel = spot.id === selectedId
        return (
          <div
            key={spot.id}
            className={['map-pin', isSel ? 'map-pin--selected' : ''].join(' ')}
            style={{ left: `${xPct}%`, top: `${yPct}%` }}
            onClick={() => onSpotClick(spot.id)}
            title={spot.name}
          >
            <span className="map-pin-name">{spot.name}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── ForecastView ──────────────────────────────────────────────────────────────
interface Props {
  spot:        Spot
  model:       WindModel
  mapView:     boolean
  allSpots:    Spot[]
  selectedId:  string
  onSpotClick: (id: string) => void
  onDayClick:  (dayOffset: number) => void
}

export function ForecastView({
  spot, model, mapView, allSpots, selectedId, onSpotClick, onDayClick,
}: Props) {
  const { data, loading, error } = useForecast(spot.lat, spot.lng, model)
  const isBlend   = model === 'BLEND'
  const windColor = isBlend ? '#6366F1' : '#2563EB'

  if (mapView) {
    return (
      <MyMapView
        spots={allSpots}
        selectedId={selectedId}
        onSpotClick={onSpotClick}
      />
    )
  }

  return (
    <div className="forecast-container">
      {/* Header */}
      <div className="forecast-header">
        <h1 className="forecast-title">{spot.name}</h1>
        <span className="forecast-country">{spot.country}</span>
        <span className={['model-tag', isBlend ? 'model-tag--blend' : ''].join(' ')}>
          {isBlend ? '⊕ BLEND' : model}
        </span>
        <span className="forecast-hint">Click any day for hourly detail</span>
      </div>

      {error && <div className="error-banner">Could not load forecast: {error}</div>}

      {/* Day strip */}
      {loading ? (
        <div className="day-strip-skeleton">
          {Array.from({ length: 7 }, (_, i) => <SkeletonBar key={i} h={120} />)}
        </div>
      ) : (
        <div className="day-strip">
          {data.map((d, i) => (
            <DayCard key={i} d={d} isBlend={isBlend} onClick={() => onDayClick(i)} />
          ))}
        </div>
      )}

      {/* Wind chart */}
      <Section title="Wind Speed" sub="knots · avg vs gust">
        {loading ? <SkeletonBar h={180} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={windColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={windColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="gust" stroke="#93C5FD" strokeWidth={1.5}
                fill="none" name="Gust" dot={false} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="wind" stroke={windColor} strokeWidth={2.5}
                fill="url(#windGrad)" name="Wind"
                dot={{ r: 3, fill: windColor, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Temp + Rain */}
      <div className="two-col">
        <Section title="Temperature" sub="°C">
          {loading ? <SkeletonBar h={140} /> : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={data} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="temp" stroke="#F97316" strokeWidth={2.5}
                  dot={{ r: 3, fill: '#F97316', strokeWidth: 0 }} name="Temp" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Precipitation" sub="mm">
          {loading ? <SkeletonBar h={140} /> : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A96A8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="rain" fill="#38BDF8" radius={[4, 4, 0, 0]} name="Rain" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Tide */}
      <Section title="Tide" sub="metres · 7-day cycle">
        {loading ? <SkeletonBar h={120} /> : (
          <>
            <TideChart data={data} />
            <div className="tide-times">
              {data.map((d, i) => (
                <div key={i} className="tide-day">
                  <div className="tide-day-label">{d.day}</div>
                  <div className="tide-high">↑{d.tideHigh.toFixed(1)}h</div>
                  <div className="tide-low">↓{d.tideLow.toFixed(1)}h</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Model comparison */}
      <ModelComparison spot={spot} activeModel={model} onModelChange={() => {}} />
    </div>
  )
}
