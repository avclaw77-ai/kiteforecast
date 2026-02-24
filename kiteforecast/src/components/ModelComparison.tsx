import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useForecast }                      from '../hooks/useForecast'
import { BASE_MODELS, convertSpeed, speedLabel } from '../types'
import type { Spot, WindModel, DayForecast, AppSettings } from '../types'

// ── Distinct color per model ─────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  GFS:   '#2563EB',  // blue
  ECMWF: '#10B981',  // emerald
  ICON:  '#F59E0B',  // amber
  MF:    '#8B5CF6',  // violet
  GEM:   '#EF4444',  // red
}

// ── Single model data hook ───────────────────────────────────────────────────
function useModelData(lat: number, lng: number, model: WindModel) {
  const { data } = useForecast(lat, lng, model)
  return data
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  spot:          Spot
  activeModel:   WindModel
  onModelChange: (m: WindModel) => void
  settings:      AppSettings
}

export function ModelComparison({ spot, settings }: Props) {
  const su = settings.speedUnit
  const visibleModels = BASE_MODELS.filter(m => settings.enabledModels.includes(m))

  // Fetch all base models in parallel
  const gfs   = useModelData(spot.lat, spot.lng, 'GFS')
  const ecmwf = useModelData(spot.lat, spot.lng, 'ECMWF')
  const icon  = useModelData(spot.lat, spot.lng, 'ICON')
  const mf    = useModelData(spot.lat, spot.lng, 'MF')
  const gem   = useModelData(spot.lat, spot.lng, 'GEM')

  const allData: Record<string, DayForecast[]> = {
    GFS: gfs, ECMWF: ecmwf, ICON: icon, MF: mf, GEM: gem,
  }

  // Build chart data: one entry per day with wind per model
  const days = gfs.length || ecmwf.length || icon.length || mf.length || gem.length || 0
  if (days === 0) return null

  const chartData = Array.from({ length: days }, (_, i) => {
    const entry: Record<string, any> = {
      day: gfs[i]?.day || ecmwf[i]?.day || icon[i]?.day || mf[i]?.day || gem[i]?.day || '',
    }
    for (const m of visibleModels) {
      const raw = allData[m]?.[i]?.wind
      entry[m] = raw != null ? convertSpeed(raw, su) : null
    }
    return entry
  })

  // Custom tooltip
  function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'white', border: '1px solid #E2E8F0', borderRadius: 8,
        padding: '8px 12px', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color, marginBottom: 1 }}>
            {p.dataKey}: <strong>{p.value} {speedLabel(su)}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Model Overlay</span>
        <span className="section-sub">wind speed · {speedLabel(su)}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: '#8A96A8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8A96A8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            iconType="line"
            iconSize={14}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
          {visibleModels.map(m => (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              stroke={MODEL_COLORS[m]}
              strokeWidth={2}
              dot={{ r: 3, fill: MODEL_COLORS[m], strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
