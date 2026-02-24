import { useForecast }               from '../hooks/useForecast'
import { windRating, ratingColor }   from '../types'
import { ALL_MODELS }                from '../types'
import type { Spot, WindModel }      from '../types'

// ── Model card ────────────────────────────────────────────────────────────────
function ModelCard({ spot, model, isActive, onSelect }: {
  spot:     Spot
  model:    WindModel
  isActive: boolean
  onSelect: () => void
}) {
  const { data, loading } = useForecast(spot.lat, spot.lng, model)
  const isBlend = model === 'BLEND'

  const avg = data.length
    ? Math.round(data.reduce((a, d) => a + d.wind, 0) / data.length)
    : 0

  const maxSpread = isBlend && data.length
    ? Math.max(...data.map(d => d.spread ?? 0))
    : null

  const color = ratingColor(windRating(avg))

  return (
    <div
      onClick={onSelect}
      className={[
        'model-card',
        isActive            ? 'model-card--active'       : '',
        isBlend             ? 'model-card--blend'        : '',
        isActive && isBlend ? 'model-card--blend-active' : '',
      ].join(' ')}
    >
      <div className="model-card-name">
        {isBlend ? '⊕ BLEND' : model}
      </div>
      <div className="model-card-wind" style={{ color }}>
        {loading ? '…' : avg}
      </div>
      <div className="model-card-unit">kts avg</div>
      {maxSpread != null && (
        <div className="model-card-spread">
          ±{Math.round(maxSpread / 2)} kts spread
        </div>
      )}
      <div
        className="model-card-bar"
        style={{
          background: isBlend
            ? 'linear-gradient(to right, #6366F1, #2563EB)'
            : `linear-gradient(to right, ${color}, #E8EDF3)`,
        }}
      />
    </div>
  )
}

// ── ModelComparison ───────────────────────────────────────────────────────────
interface Props {
  spot:          Spot
  activeModel:   WindModel
  onModelChange: (m: WindModel) => void
}

export function ModelComparison({ spot, activeModel, onModelChange }: Props) {
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">Model Comparison</span>
        <span className="section-sub">avg wind this week · knots</span>
      </div>
      <div className="model-comparison">
        {ALL_MODELS.map(m => (
          <ModelCard
            key={m}
            spot={spot}
            model={m}
            isActive={m === activeModel}
            onSelect={() => onModelChange(m)}
          />
        ))}
      </div>
    </div>
  )
}
