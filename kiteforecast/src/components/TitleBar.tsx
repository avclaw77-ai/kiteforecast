import type { WindModel } from '../types'
import { ALL_MODELS } from '../types'

interface Props {
  spotName?:       string
  country?:        string
  model:           WindModel
  onModelChange:   (m: WindModel) => void
  mapActive:       boolean
  onToggleMap:     () => void
  enabledModels:   WindModel[]
  onSettingsClick: () => void
}

export function TitleBar({
  model, onModelChange, enabledModels, onSettingsClick,
}: Props) {
  const visibleModels = ALL_MODELS.filter(m => enabledModels.includes(m))

  return (
    <header className="titlebar">
      <div className="titlebar-traffic-light-spacer" />

      <span className="titlebar-title">KiteForecast</span>

      <nav className="titlebar-nav no-drag">
        {visibleModels.map(m => {
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

        <button className="settings-btn" onClick={onSettingsClick}>
          ⚙
        </button>
      </nav>
    </header>
  )
}
