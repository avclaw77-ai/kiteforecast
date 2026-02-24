import { useState }                         from 'react'
import { MapContainer, TileLayer,
         Marker, Popup, useMapEvents }       from 'react-leaflet'
import L                                     from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { KNOWN_SPOTS }                       from '../data/knownSpots'
import { AnemometerGauge }                   from './AnemometerGauge'
import { useMapLiveWinds }                   from '../hooks/useMapLiveWinds'
import { windRating, ratingColor, dirLabel } from '../types'
import type { Spot }                         from '../types'

// Fix Leaflet default icon paths broken by Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Colored circle icon ───────────────────────────────────────────────────────
function makeIcon(color: string, size = 32) {
  return L.divIcon({
    className:  '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.25);
        display:flex;align-items:center;justify-content:center;
      "></div>`,
  })
}

// ── Drop pin handler ──────────────────────────────────────────────────────────
function DropPinHandler({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onDrop(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  mySpotIds: string[]
  onAdd:     (spot: Spot) => void
  onClose:   () => void
}

export function AddSpotMap({ mySpotIds, onAdd, onClose }: Props) {
  const liveWinds                       = useMapLiveWinds()
  const [tab,         setTab]           = useState<'map' | 'list'>('map')
  const [search,      setSearch]        = useState('')
  const [pending,     setPending]       = useState<{ lat: number; lng: number } | null>(null)
  const [pendingName, setPendingName]   = useState('')

  const filtered = KNOWN_SPOTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())    ||
    s.country.toLowerCase().includes(search.toLowerCase()) ||
    s.region.toLowerCase().includes(search.toLowerCase())
  )

  function handleAddKnown(spot: typeof KNOWN_SPOTS[0]) {
    if (mySpotIds.includes(spot.id)) return
    onAdd({ ...spot })
  }

  function handleAddCustom() {
    if (!pending || !pendingName.trim()) return
    onAdd({
      id:      `custom-${Date.now()}`,
      name:    pendingName.trim(),
      country: '?',
      region:  'Custom',
      lat:     pending.lat,
      lng:     pending.lng,
      isKnown: false,
      wind:    15,
      gust:    22,
      dir:     0,
    })
    setPending(null)
    setPendingName('')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="add-spot-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 20px', background: '#fff', borderBottom: '1px solid #E8EDF3', flexShrink: 0 }}>
          <button className="modal-back" onClick={onClose}>✕</button>
          <div>
            <div className="modal-title">Add a Kitespot</div>
            <div className="modal-subtitle">
              Pick a preset · or click anywhere on the map to drop a pin
            </div>
          </div>
          <div className="tab-switcher">
            {(['map', 'list'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={['tab-btn', tab === t ? 'tab-btn--active' : ''].join(' ')}
              >
                {t === 'map' ? '🗺 Map' : '📋 List'}
              </button>
            ))}
          </div>
        </div>

        {/* Map tab */}
        {tab === 'map' && (
          <div className="add-spot-map-wrap">
            <MapContainer
              center={[20, 10]}
              zoom={2}
              style={{ width: '100%', height: '100%' }}
              zoomControl
            >
              <TileLayer
                attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <DropPinHandler onDrop={(lat, lng) => {
                setPending({ lat: +lat.toFixed(5), lng: +lng.toFixed(5) })
                setPendingName('')
              }} />

              {/* Known spot markers */}
              {KNOWN_SPOTS.map(spot => {
                const lw      = liveWinds[spot.id] ?? { wind: spot.wind, gust: spot.gust }
                const color   = ratingColor(windRating(lw.wind))
                const isAdded = mySpotIds.includes(spot.id)
                return (
                  <Marker
                    key={spot.id}
                    position={[spot.lat, spot.lng]}
                    icon={makeIcon(isAdded ? '#94A3B8' : color, 34)}
                    opacity={isAdded ? 0.55 : 1}
                  >
                    <Popup>
                      <div className="map-popup">
                        <div className="map-popup-name">{spot.name}</div>
                        <div className="map-popup-meta">{spot.country} · {spot.region}</div>
                        <AnemometerGauge
                          baseWind={lw.wind}
                          baseGust={lw.gust}
                          dir={spot.dir}
                        />
                        {!isAdded ? (
                          <button
                            className="map-popup-add-btn"
                            onClick={() => handleAddKnown(spot)}
                          >
                            + Add to my spots
                          </button>
                        ) : (
                          <div className="map-popup-added">✓ Already in my spots</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {/* Custom pending marker */}
              {pending && (
                <Marker position={[pending.lat, pending.lng]}>
                  <Popup>
                    <div className="map-popup">
                      <div className="map-popup-name">New custom spot</div>
                      <div className="map-popup-meta">
                        {pending.lat.toFixed(3)}, {pending.lng.toFixed(3)}
                      </div>
                      <input
                        className="map-popup-input"
                        placeholder="Name this spot…"
                        value={pendingName}
                        onChange={e => setPendingName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                        autoFocus
                      />
                      <button
                        className="map-popup-add-btn"
                        onClick={handleAddCustom}
                        disabled={!pendingName.trim()}
                      >
                        Add spot
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Legend */}
            <div className="map-legend">
              {([['#10B981', '15–30 kts'], ['#F59E0B', '10–35 kts'], ['#EF4444', 'other']] as const).map(([color, label]) => (
                <span key={label} className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: color }} />
                  {label}
                </span>
              ))}
              <span className="map-legend-hint">· click map to add custom spot</span>
            </div>
          </div>
        )}

        {/* List tab */}
        {tab === 'list' && (
          <div className="spot-list-wrap">
            <div className="spot-list-search">
              <span className="spot-list-search-icon">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, country or region…"
                className="spot-list-input"
              />
            </div>
            <div className="spot-list">
              {filtered.map(spot => {
                const lw      = liveWinds[spot.id] ?? { wind: spot.wind, gust: spot.gust }
                const color   = ratingColor(windRating(lw.wind))
                const isAdded = mySpotIds.includes(spot.id)
                return (
                  <div
                    key={spot.id}
                    className={['spot-list-row', isAdded ? 'spot-list-row--added' : ''].join(' ')}
                    onClick={() => handleAddKnown(spot)}
                  >
                    <div className="spot-list-dot" style={{ background: color }} />
                    <div className="spot-list-info">
                      <div className="spot-list-name">{spot.name}</div>
                      <div className="spot-list-meta">{spot.country} · {spot.region}</div>
                    </div>
                    <div className="spot-list-wind">
                      <div style={{ color, fontWeight: 700 }}>{lw.wind}</div>
                      <div className="spot-list-gust">↑{lw.gust} kts</div>
                    </div>
                    {isAdded
                      ? <span className="spot-list-check">✓</span>
                      : <span className="spot-list-plus">+</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
