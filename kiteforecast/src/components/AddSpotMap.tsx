import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader }                                   from '@googlemaps/js-api-loader'

import { KNOWN_SPOTS }                              from '../data/knownSpots'
import { useMapLiveWinds }                          from '../hooks/useMapLiveWinds'
import { windRating, ratingColor }                  from '../types'
import type { Spot }                                from '../types'

const GMAP_KEY = 'AIzaSyBl2RUxrzYi3vRhlNf7O3S_asndmMQsIj0'

// ISO country code → full name for search
const COUNTRY_NAMES: Record<string, string> = {
  BR: 'Brazil', CA: 'Canada', CV: 'Cape Verde', DO: 'Dominican Republic',
  EG: 'Egypt', ES: 'Spain', FR: 'France', KE: 'Kenya', LK: 'Sri Lanka',
  LV: 'Latvia', MA: 'Morocco', PE: 'Peru', PH: 'Philippines', TZ: 'Tanzania',
  US: 'United States', VN: 'Vietnam', ZA: 'South Africa',
}

// ── Google Maps loader (singleton) ───────────────────────────────────────────
const loader = new Loader({ apiKey: GMAP_KEY, version: 'weekly' })

let googleReady: Promise<typeof google> | null = null
function loadGoogle() {
  if (!googleReady) googleReady = loader.load()
  return googleReady
}

// ── SVG circle icon for markers ──────────────────────────────────────────────
function circleIcon(color: string, size = 24, opacity = 1): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" fill-opacity="${opacity}"
      stroke="white" stroke-width="2.5"/>
  </svg>`
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size),
    anchor:     new google.maps.Point(size / 2, size / 2),
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="add-spot-toast">
      <span className="add-spot-toast-icon">✓</span>
      {message}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  mySpotIds: string[]
  onAdd:     (spot: Spot) => void
  onClose:   () => void
}

export function AddSpotMap({ mySpotIds, onAdd, onClose }: Props) {
  const liveWinds = useMapLiveWinds()
  const [tab,            setTab]            = useState<'map' | 'list'>('map')
  const [search,         setSearch]         = useState('')
  const [pending,        setPending]        = useState<{ lat: number; lng: number } | null>(null)
  const [pendingCountry, setPendingCountry] = useState('')
  const [toast,          setToast]          = useState<string | null>(null)
  const [addedIds,       setAddedIds]       = useState<Set<string>>(new Set(mySpotIds))

  const mapDivRef  = useRef<HTMLDivElement>(null)
  const gmapRef    = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const pinRef     = useRef<google.maps.Marker | null>(null)
  const infoRef    = useRef<google.maps.InfoWindow | null>(null)

  // Keep addedIds accessible in closures
  const addedIdsRef = useRef(addedIds)
  addedIdsRef.current = addedIds

  // Ref for pendingCountry so info-window button gets latest value
  const pendingCountryRef = useRef(pendingCountry)
  pendingCountryRef.current = pendingCountry

  // ── Reverse geocode via Google ─────────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAP_KEY}&result_type=country`
      )
      const data = await res.json()
      const country = data?.results?.[0]?.formatted_address || ''
      setPendingCountry(country)
    } catch {
      setPendingCountry('')
    }
  }, [])

  // ── Add a custom spot ──────────────────────────────────────────────────────
  const doAddCustom = useCallback((name: string, loc: { lat: number; lng: number }) => {
    const newSpot: Spot = {
      id:      `custom-${Date.now()}`,
      name,
      country: pendingCountryRef.current || 'Custom',
      region:  'Custom',
      lat:     loc.lat,
      lng:     loc.lng,
      isKnown: false,
      wind:    15,
      gust:    22,
      dir:     0,
    }
    onAdd(newSpot)
    setToast(`${newSpot.name} added!`)
    setPending(null)
    setPendingCountry('')
    infoRef.current?.close()
    if (pinRef.current) { pinRef.current.setMap(null); pinRef.current = null }
  }, [onAdd])

  // ── Add known spot ─────────────────────────────────────────────────────────
  const handleAddKnown = useCallback((spot: typeof KNOWN_SPOTS[0]) => {
    if (addedIdsRef.current.has(spot.id)) return
    onAdd({ ...spot })
    setAddedIds(prev => new Set(prev).add(spot.id))
    setToast(`${spot.name} added!`)
    infoRef.current?.close()
  }, [onAdd])

  // ── Initialize map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'map' || !mapDivRef.current || gmapRef.current) return

    loadGoogle().then(() => {
      if (!mapDivRef.current) return
      const map = new google.maps.Map(mapDivRef.current, {
        center:            { lat: 20, lng: 10 },
        zoom:              2,
        disableDefaultUI:  false,
        zoomControl:       true,
        mapTypeControl:    false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling:   'greedy',
      })
      gmapRef.current = map
      infoRef.current = new google.maps.InfoWindow()

      // ── Geolocation: auto-center on user's location ─────────────────────────
      function geolocate() {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
          pos => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            map.panTo(loc)
            map.setZoom(8)
          },
          () => { /* permission denied or error — stay on world view */ },
          { enableHighAccuracy: false, timeout: 5000 }
        )
      }
      geolocate()

      // ── "Locate me" button ──────────────────────────────────────────────────
      const locBtn = document.createElement('button')
      locBtn.textContent = '📍'
      locBtn.title = 'Center on my location'
      Object.assign(locBtn.style, {
        background: 'white', border: 'none', borderRadius: '4px',
        boxShadow: '0 1px 4px rgba(0,0,0,.2)', cursor: 'pointer',
        fontSize: '18px', padding: '6px 8px', margin: '10px',
        lineHeight: '1',
      })
      locBtn.addEventListener('click', geolocate)
      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locBtn)

      // Click to drop custom pin
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return
        const lat = +e.latLng.lat().toFixed(5)
        const lng = +e.latLng.lng().toFixed(5)
        setPending({ lat, lng })
        setPendingCountry('')
        reverseGeocode(lat, lng)
      })

      // Add known spot markers
      KNOWN_SPOTS.forEach(spot => {
        const lw    = liveWinds[spot.id] ?? { wind: spot.wind, gust: spot.gust }
        const color = ratingColor(windRating(lw.wind))
        const added = addedIdsRef.current.has(spot.id)

        const marker = new google.maps.Marker({
          position: { lat: spot.lat, lng: spot.lng },
          map,
          icon:    circleIcon(color, 26, added ? 0.55 : 1),
          title:   spot.name,
          zIndex:  added ? 1 : 10,
        })

        marker.addListener('click', () => {
          if (!infoRef.current) return
          const isAdded = addedIdsRef.current.has(spot.id)

          const html = document.createElement('div')
          html.style.cssText = 'min-width:160px;font-family:system-ui,sans-serif;'
          html.innerHTML = `
            <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${spot.name}</div>
            <div style="font-size:11px;color:#8A96A8;margin-bottom:8px;">${spot.country} · ${spot.region}</div>
            <div style="font-size:12px;margin-bottom:8px;">
              Wind: <b>${lw.wind} kts</b> · Gust: <b>${lw.gust} kts</b>
            </div>
          `
          if (!isAdded) {
            const btn = document.createElement('button')
            btn.textContent = '+ Add to my spots'
            btn.style.cssText = `
              width:100%;padding:6px 0;border:none;border-radius:6px;
              background:#2563EB;color:white;font-size:12px;font-weight:600;cursor:pointer;
            `
            btn.onclick = () => handleAddKnown(spot)
            html.appendChild(btn)
          } else {
            const d = document.createElement('div')
            d.textContent = '✓ Added'
            d.style.cssText = 'font-size:11px;color:#10B981;font-weight:600;'
            html.appendChild(d)
          }

          infoRef.current.setContent(html)
          infoRef.current.open(map, marker)
        })

        markersRef.current.push(marker)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Custom pin marker + info window ────────────────────────────────────────
  useEffect(() => {
    if (!gmapRef.current || !infoRef.current) return

    // Remove old pin
    if (pinRef.current) { pinRef.current.setMap(null); pinRef.current = null }
    if (!pending) return

    const pin = new google.maps.Marker({
      position: { lat: pending.lat, lng: pending.lng },
      map:      gmapRef.current,
      icon:     circleIcon('#2563EB', 30),
      zIndex:   100,
    })
    pinRef.current = pin

    // Build info window content
    const wrap = document.createElement('div')
    wrap.style.cssText = 'min-width:180px;font-family:system-ui,sans-serif;'
    wrap.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:2px;">New custom spot</div>
      <div style="font-size:11px;color:#8A96A8;margin-bottom:8px;">
        ${pending.lat.toFixed(3)}, ${pending.lng.toFixed(3)}
      </div>
    `
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Name this spot…'
    input.style.cssText = `
      width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #E2E8F0;
      border-radius:6px;font-size:12px;margin-bottom:6px;outline:none;
    `

    const btn = document.createElement('button')
    btn.textContent = 'Add spot'
    btn.style.cssText = `
      width:100%;padding:6px 0;border:none;border-radius:6px;
      background:#2563EB;color:white;font-size:12px;font-weight:600;
      cursor:pointer;opacity:0.5;
    `
    btn.disabled = true

    input.oninput = () => {
      const ok = input.value.trim().length > 0
      btn.disabled = !ok
      btn.style.opacity = ok ? '1' : '0.5'
    }

    const loc = pending
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && input.value.trim()) doAddCustom(input.value.trim(), loc)
    }
    btn.onclick = () => {
      if (input.value.trim()) doAddCustom(input.value.trim(), loc)
    }

    wrap.appendChild(input)
    wrap.appendChild(btn)

    infoRef.current.setContent(wrap)
    infoRef.current.open(gmapRef.current, pin)

    setTimeout(() => input.focus(), 150)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  // ── List helpers ───────────────────────────────────────────────────────────
  // Normalize: lowercase + strip accents for search matching
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const q = norm(search)
  const filtered = !q ? KNOWN_SPOTS : KNOWN_SPOTS.filter(s => {
    const countryFull = COUNTRY_NAMES[s.country.toUpperCase()] || ''
    return (
      norm(s.name).includes(q)        ||
      norm(s.country).includes(q)     ||
      norm(countryFull).includes(q)   ||
      norm(s.region).includes(q)
    )
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="add-spot-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 20px', background: '#fff', borderBottom: '1px solid #E8EDF3', flexShrink: 0 }}>
          <button className="modal-back" onClick={onClose}>✕</button>
          <div>
            <div className="modal-title">Add a Kitespot</div>
            <div className="modal-subtitle">
              Pick a preset · or click the map to drop a pin
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
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
            <button className="done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}

        {/* Map tab */}
        {tab === 'map' && (
          <div className="add-spot-map-wrap">
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

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
                const isAdded = addedIds.has(spot.id)
                return (
                  <div
                    key={spot.id}
                    className={['spot-list-row', isAdded ? 'spot-list-row--added' : ''].join(' ')}
                    onClick={() => !isAdded && handleAddKnown(spot)}
                  >
                    <div className="spot-list-dot" style={{ background: color }} />
                    <div className="spot-list-info">
                      <div className="spot-list-name">{spot.name}</div>
                      <div className="spot-list-meta">{COUNTRY_NAMES[spot.country.toUpperCase()] || spot.country} · {spot.region}</div>
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
