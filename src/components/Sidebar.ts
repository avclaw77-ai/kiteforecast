import { useForecast }                    from '../hooks/useForecast'
import { windRating, ratingColor }         from '../types'
import type { Spot, WindModel }            from '../types'

// ── Single spot row ───────────────────────────────────────────────────────────
function SpotRow({
  spot, isSelected, model, onSelect, onRemove,
}: {
  spot:       Spot
  isSelected: boolean
  model:      WindModel
  onSelect:   () => void
  onRemove:   () => void
}) {
  const { data, loading } = useForecast(spot.lat, spot.lng, model)
  const avg = data.length
    ? Math.round(data.reduce((a, d) => a + d.wind, 0) / data.length)
    : spot.wind

  const color = ratingColor(windRating(avg))

  return (
    <div
      onClick={onSelect}
      className={['spot-row', isSelected ? 'spot-row--active' : ''].join(' ')}
    >
      <span className="spot-dot" style={{ background: color }} />

      <div className="spot-row-info">
        <span className="spot-row-name">{spot.name}</span>
        <span className="spot-row-meta">
          {loading ? '…' : `${avg} kts avg`}
        </span>
      </div>

      <button
        className="spot-remove-btn"
        onClick={e => { e.stopPropagation(); onRemove() }}
        title="Remove spot"
      >
        ✕
      </button>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface Props {
  spots:       Spot[]
  selectedId:  string
  activeModel: WindModel
  onSelect:    (id: string) => void
  onRemove:    (id: string) => void
  onAddClick:  () => void
}

export function Sidebar({
  spots, selectedId, activeModel, onSelect, onRemove, onAddClick,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-label">My Spots</div>

      <div className="sidebar-list">
        {spots.map(spot => (
          <SpotRow
            key={spot.id}
            spot={spot}
            isSelected={spot.id === selectedId}
            model={activeModel}
            onSelect={() => onSelect(spot.id)}
            onRemove={() => onRemove(spot.id)}
          />
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="add-spot-btn" onClick={onAddClick}>
          + Add spot
        </button>
      </div>
    </aside>
  )
}
