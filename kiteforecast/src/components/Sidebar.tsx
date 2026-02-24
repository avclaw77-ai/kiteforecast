import { useState, useRef, useEffect, useCallback } from 'react'
import { useForecast }                    from '../hooks/useForecast'
import { windRating, ratingColor, dirLabel } from '../types'
import type { Spot, WindModel }            from '../types'

// ── Wind direction arrow ──────────────────────────────────────────────────────
function MiniArrow({ deg }: { deg: number }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24"
      style={{ transform: `rotate(${deg}deg)`, opacity: 0.6, flexShrink: 0 }}>
      <path d="M12 2 L8 18 L12 14 L16 18 Z" fill="#64748B" />
    </svg>
  )
}

// ── Single spot row ───────────────────────────────────────────────────────────
function SpotRow({
  spot, isSelected, model, onSelect, onRemove,
  isDragging, isOver,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  spot:       Spot
  isSelected: boolean
  model:      WindModel
  onSelect:   () => void
  onRemove:   () => void
  isDragging: boolean
  isOver:     boolean
  onDragStart: () => void
  onDragOver:  (e: React.DragEvent) => void
  onDragEnd:   () => void
  onDrop:      (e: React.DragEvent) => void
}) {
  const { data, loading } = useForecast(spot.lat, spot.lng, model)
  const avg = data.length
    ? Math.round(data.reduce((a, d) => a + d.wind, 0) / data.length)
    : spot.wind

  const avgDir = data.length
    ? Math.round(data.reduce((a, d) => a + d.dirDeg, 0) / data.length)
    : spot.dir

  const color = ratingColor(windRating(avg))

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onClick={onSelect}
      className={[
        'spot-row',
        isSelected  ? 'spot-row--active'   : '',
        isDragging  ? 'spot-row--dragging'  : '',
        isOver      ? 'spot-row--dragover'  : '',
      ].join(' ')}
    >
      <span className="spot-drag-handle" title="Drag to reorder">⠿</span>
      <span className="spot-dot" style={{ background: color }} />

      <div className="spot-row-info">
        <span className="spot-row-name">{spot.name}</span>
        <span className="spot-row-meta">
          {loading ? '…' : (
            <>
              {avg} kts {dirLabel(avgDir)}
              <MiniArrow deg={avgDir} />
            </>
          )}
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
  onReorder:   (ids: string[]) => void
  onAddClick:  () => void
}

export function Sidebar({
  spots, selectedId, activeModel, onSelect, onRemove, onReorder, onAddClick,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const checkScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8
    const noOverflow = el.scrollHeight <= el.clientHeight
    setAtBottom(isAtBottom || noOverflow)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [spots.length, checkScroll])

  function handleDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
  }

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return }
    const ids = spots.map(s => s.id)
    const [moved] = ids.splice(dragIdx, 1)
    ids.splice(targetIdx, 0, moved)
    onReorder(ids)
    handleDragEnd()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-label">
        My Spots
        {spots.length > 0 && (
          <span className="sidebar-count">{spots.length}</span>
        )}
      </div>

      <div
        ref={listRef}
        className={['sidebar-list', atBottom ? 'sidebar-list--at-bottom' : ''].join(' ')}
        onScroll={checkScroll}
      >
        {spots.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">🗺</div>
            <div className="sidebar-empty-text">No spots added yet</div>
          </div>
        ) : (
          spots.map((spot, i) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              isSelected={spot.id === selectedId}
              model={activeModel}
              onSelect={() => onSelect(spot.id)}
              onRemove={() => onRemove(spot.id)}
              isDragging={dragIdx === i}
              isOver={overIdx === i}
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
              onDragEnd={handleDragEnd}
              onDrop={e => { e.preventDefault(); handleDrop(i) }}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="add-spot-btn" onClick={onAddClick}>
          + Add spot
        </button>
      </div>
    </aside>
  )
}
