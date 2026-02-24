import { useState, useEffect } from 'react'
import { Sidebar }        from './components/Sidebar'
import { TitleBar }       from './components/TitleBar'
import { ForecastView }   from './components/ForecastView'
import { HourlyPanel }    from './components/HourlyPanel'
import { AddSpotMap }     from './components/AddSpotMap'
import { SettingsPanel }  from './components/SettingsPanel'
import { useSpots }       from './hooks/useSpots'
import { useSettings }    from './hooks/useSettings'
import { setStormGlassKey, fetchTideData } from './api/tide'
import type { WindModel, Spot } from './types'
import './styles/global.css'

export default function App() {
  const { spots, loading, addSpot, removeSpot, reorderSpots } = useSpots()
  const { settings, update: updateSettings } = useSettings()

  const [selId,        setSelId]        = useState<string | null>(null)
  const [model,        setModel]        = useState<WindModel>('GFS')
  const [selDay,       setSelDay]       = useState<number | null>(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [showMapView,  setShowMapView]  = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Auto-select first spot when spots load
  useEffect(() => {
    if (!selId && spots.length > 0) {
      setSelId(spots[0].id)
    }
  }, [spots, selId])

  // Sync Storm Glass API key
  useEffect(() => {
    setStormGlassKey(settings.stormGlassKey)
  }, [settings.stormGlassKey])

  const selSpot: Spot | undefined =
    spots.find(s => s.id === selId) ?? spots[0]

  // Fetch tide data when spot changes (uses cache, max 1 API call/day/spot)
  useEffect(() => {
    if (selSpot) fetchTideData(selSpot.lat, selSpot.lng)
  }, [selSpot?.id, settings.stormGlassKey])

  async function handleAddSpot(spot: Spot) {
    await addSpot(spot)
    setSelId(spot.id)
    // Don't close modal — let user add multiple spots
  }

  async function handleRemoveSpot(id: string) {
    await removeSpot(id)
    if (selId === id) {
      const remaining = spots.filter(s => s.id !== id)
      setSelId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-icon">🪁</div>
        <div className="loading-text">Loading KiteForecast…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      <TitleBar
        spotName={selSpot?.name}
        country={selSpot?.country}
        model={model}
        onModelChange={setModel}
        mapActive={showMapView}
        onToggleMap={() => setShowMapView(v => !v)}
        enabledModels={settings.enabledModels}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          spots={spots}
          selectedId={selId ?? ''}
          activeModel={model}
          onSelect={setSelId}
          onRemove={handleRemoveSpot}
          onReorder={reorderSpots}
          onAddClick={() => setShowAdd(true)}
        />

        <main className="flex-1 overflow-auto">
          {selSpot ? (
            <ForecastView
              spot={selSpot}
              model={model}
              mapView={showMapView}
              allSpots={spots}
              selectedId={selId ?? ''}
              onSpotClick={id => { setSelId(id); setShowMapView(false) }}
              onDayClick={setSelDay}
              settings={settings}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🪁</div>
              <div className="empty-state-title">No spots yet</div>
              <div className="empty-state-sub">Add your first kitespot to see the forecast</div>
              <button className="empty-state-btn" onClick={() => setShowAdd(true)}>
                + Add a spot
              </button>
            </div>
          )}
        </main>
      </div>

      {selSpot && selDay !== null && (
        <HourlyPanel
          spot={selSpot}
          model={model}
          dayOffset={selDay}
          onClose={() => setSelDay(null)}
          settings={settings}
        />
      )}

      {showAdd && (
        <AddSpotMap
          mySpotIds={spots.map(s => s.id)}
          onAdd={handleAddSpot}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
