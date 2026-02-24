import { useState } from 'react'
import { Sidebar }       from './components/Sidebar'
import { TitleBar }      from './components/TitleBar'
import { ForecastView }  from './components/ForecastView'
import { HourlyPanel }   from './components/HourlyPanel'
import { AddSpotMap }    from './components/AddSpotMap'
import { useSpots }      from './hooks/useSpots'
import type { WindModel, Spot } from './types'
import './styles/globals.css'

export default function App() {
  const { spots, loading, addSpot, removeSpot } = useSpots()

  const [selId,       setSelId]       = useState<string>('k1')
  const [model,       setModel]       = useState<WindModel>('GFS')
  const [selDay,      setSelDay]      = useState<number | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showMapView, setShowMapView] = useState(false)

  const selSpot: Spot | undefined =
    spots.find(s => s.id === selId) ?? spots[0]

  async function handleAddSpot(spot: Spot) {
    await addSpot(spot)
    setSelId(spot.id)
    setShowAdd(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-muted text-sm">Loading spots…</div>
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
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          spots={spots}
          selectedId={selId}
          activeModel={model}
          onSelect={setSelId}
          onRemove={removeSpot}
          onAddClick={() => setShowAdd(true)}
        />

        <main className="flex-1 overflow-auto">
          {selSpot && (
            <ForecastView
              spot={selSpot}
              model={model}
              mapView={showMapView}
              allSpots={spots}
              selectedId={selId}
              onSpotClick={id => { setSelId(id); setShowMapView(false) }}
              onDayClick={setSelDay}
            />
          )}
        </main>
      </div>

      {selSpot && selDay !== null && (
        <HourlyPanel
          spot={selSpot}
          model={model}
          dayOffset={selDay}
          onClose={() => setSelDay(null)}
        />
      )}

      {showAdd && (
        <AddSpotMap
          mySpotIds={spots.map(s => s.id)}
          onAdd={handleAddSpot}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
