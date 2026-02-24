import type { WindModel } from '../types'
import { ALL_MODELS } from '../types'

interface Props {
  spotName?:     string
  country?:      string
  model:         WindModel
  onModelChange: (m: WindModel) => void
  mapActive:     boolean
  onToggleMap:   () => void
}

export function TitleBar({
  spotName, country, model, onModelChange, mapActive, onToggleMap,
}: Props) {
  return (
    <header className="titlebar">
      <div className="titlebar-traffic-light-spacer" />

      <span className="titlebar-title">KiteForecast</span>
      {spotName && (
        <span className="titlebar-subtitle">
          — {spotName}{country ? `, ${country}` : ''}
        </span>
      )}

      <nav className="titlebar-nav no-drag">
        {ALL_MODELS.map(m => {
          const isBlend  = m === 'BLEND'
          const isActive = model === m
          return (
            <button
              key={m}
              onClick={() => onModelChange(m)}
              className={[
                'model-btn',
                isBlend  ? 'model-btn--blend'  : '',
                isActive ? 'model-btn--active'  : '',
                isActive && isBlend ? 'model-btn--blend-active' : '',
              ].join(' ')}
            >
              {isBlend ? '⊕ BLEND' : m}
            </button>
          )
        })}

        <div className="titlebar-divider" />

        <button
          onClick={onToggleMap}
          className={['icon-btn', mapActive ? 'icon-btn--active' : ''].join(' ')}
        >
          {mapActive ? 'Forecast' : 'Map'}
        </button>
      </nav>
    </header>
  )
}
