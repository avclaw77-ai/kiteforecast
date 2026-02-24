import { ALL_MODELS } from '../types'
import type { AppSettings, WindModel, SpeedUnit, HeightUnit, TempUnit } from '../types'

interface Props {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
  onClose:  () => void
}

function ToggleChip({ label, active, color, onClick }: {
  label: string; active: boolean; color?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:      '6px 14px',
        borderRadius: 20,
        border:       active ? '2px solid ' + (color || '#2563EB') : '2px solid #E2E8F0',
        background:   active ? (color || '#2563EB') + '18' : '#fff',
        color:        active ? (color || '#2563EB') : '#64748B',
        fontWeight:   active ? 700 : 500,
        fontSize:     12,
        cursor:       'pointer',
        transition:   'all .15s',
      }}
    >
      {label}
    </button>
  )
}

function RadioGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding:      '6px 14px',
            borderRadius: 20,
            border:       value === o.value ? '2px solid #2563EB' : '2px solid #E2E8F0',
            background:   value === o.value ? '#2563EB12' : '#fff',
            color:        value === o.value ? '#2563EB' : '#64748B',
            fontWeight:   value === o.value ? 700 : 500,
            fontSize:     12,
            cursor:       'pointer',
            transition:   'all .15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const MODEL_COLORS: Record<string, string> = {
  GFS: '#2563EB', ECMWF: '#10B981', ICON: '#F59E0B',
  MF: '#8B5CF6', GEM: '#EF4444', BLEND: '#6366F1',
}

export function SettingsPanel({ settings, onUpdate, onClose }: Props) {
  function toggleModel(m: WindModel) {
    const cur = settings.enabledModels
    const isEnabled = cur.includes(m)
    // Don't allow disabling all models
    if (isEnabled && cur.length <= 1) return
    const next = isEnabled ? cur.filter(x => x !== m) : [...cur, m]
    onUpdate({ enabledModels: next })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="modal-back" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Models */}
          <div className="settings-section">
            <div className="settings-label">Weather Models</div>
            <div className="settings-hint">Toggle which models appear in the app</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {ALL_MODELS.map(m => (
                <ToggleChip
                  key={m}
                  label={m === 'BLEND' ? '⊕ BLEND' : m}
                  active={settings.enabledModels.includes(m)}
                  color={MODEL_COLORS[m]}
                  onClick={() => toggleModel(m)}
                />
              ))}
            </div>
          </div>

          {/* Speed unit */}
          <div className="settings-section">
            <div className="settings-label">Wind Speed</div>
            <RadioGroup<SpeedUnit>
              options={[
                { value: 'kts',  label: 'Knots' },
                { value: 'mph',  label: 'MPH' },
                { value: 'km/h', label: 'km/h' },
              ]}
              value={settings.speedUnit}
              onChange={v => onUpdate({ speedUnit: v })}
            />
          </div>

          {/* Tide height */}
          <div className="settings-section">
            <div className="settings-label">Tide Height</div>
            <RadioGroup<HeightUnit>
              options={[
                { value: 'm',  label: 'Metres' },
                { value: 'ft', label: 'Feet' },
              ]}
              value={settings.heightUnit}
              onChange={v => onUpdate({ heightUnit: v })}
            />
          </div>

          {/* Temperature */}
          <div className="settings-section">
            <div className="settings-label">Temperature</div>
            <RadioGroup<TempUnit>
              options={[
                { value: '°C', label: '°C' },
                { value: '°F', label: '°F' },
              ]}
              value={settings.tempUnit}
              onChange={v => onUpdate({ tempUnit: v })}
            />
          </div>

          {/* Storm Glass API */}
          <div className="settings-section">
            <div className="settings-label">Tide Data — Storm Glass API</div>
            <div className="settings-hint">
              Free at <a href="https://stormglass.io" target="_blank" rel="noopener"
                style={{ color: '#2563EB' }}>stormglass.io</a> (10 requests/day). Leave empty to use simulated tides.
            </div>
            <input
              type="text"
              value={settings.stormGlassKey}
              onChange={e => onUpdate({ stormGlassKey: e.target.value.trim() })}
              placeholder="Paste your API key here…"
              style={{
                width: '100%', boxSizing: 'border-box', marginTop: 8,
                padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 12, fontFamily: 'monospace', outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#2563EB' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0' }}
            />
            {settings.stormGlassKey && (
              <div style={{ fontSize: 10, color: '#10B981', marginTop: 4, fontWeight: 600 }}>
                ✓ Key set — real tide data will load on next spot view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
