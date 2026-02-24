import { useState, useEffect, useCallback } from 'react'
import { KNOWN_SPOTS } from '../data/knownSpots'
import type { Spot } from '../types'

const DEFAULT_IDS = ['k1', 'k2', 'k3', 'k4', 'k5']
const STORAGE_KEY = 'kiteforecast-spots'

function getDefaultSpots(): Spot[] {
  return KNOWN_SPOTS.filter(s => DEFAULT_IDS.includes(s.id))
}

// LocalStorage fallback for when electronAPI is unavailable (dev mode, etc.)
function loadFromStorage(): Spot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return getDefaultSpots()
}

function saveToStorage(spots: Spot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots))
  } catch { /* ignore */ }
}

export function useSpots() {
  const [spots,   setSpots]   = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [useIPC,  setUseIPC]  = useState(false)

  useEffect(() => {
    const api = window.electronAPI?.spots
    if (api) {
      api.get()
        .then(data => {
          // If store returned empty (first run issue), seed with defaults
          if (!data || data.length === 0) {
            const defaults = getDefaultSpots()
            // Add defaults one by one
            Promise.all(defaults.map(s => api.add(s)))
              .then(results => {
                const final = results[results.length - 1] ?? defaults
                setSpots(final)
              })
              .catch(() => setSpots(defaults))
          } else {
            setSpots(data)
          }
          setUseIPC(true)
        })
        .catch(err => {
          console.warn('IPC spots:get failed, using localStorage:', err)
          setSpots(loadFromStorage())
        })
        .finally(() => setLoading(false))
    } else {
      console.warn('electronAPI not available, using localStorage fallback')
      setSpots(loadFromStorage())
      setLoading(false)
    }
  }, [])

  const addSpot = useCallback(async (spot: Spot) => {
    if (useIPC && window.electronAPI?.spots) {
      try {
        const updated = await window.electronAPI.spots.add(spot)
        setSpots(updated)
        return
      } catch (err) {
        console.warn('IPC spots:add failed:', err)
      }
    }
    // Fallback
    setSpots(prev => {
      if (prev.find(s => s.id === spot.id)) return prev
      const updated = [...prev, spot]
      saveToStorage(updated)
      return updated
    })
  }, [useIPC])

  const removeSpot = useCallback(async (id: string) => {
    if (useIPC && window.electronAPI?.spots) {
      try {
        const updated = await window.electronAPI.spots.remove(id)
        setSpots(updated)
        return
      } catch (err) {
        console.warn('IPC spots:remove failed:', err)
      }
    }
    // Fallback
    setSpots(prev => {
      const updated = prev.filter(s => s.id !== id)
      saveToStorage(updated)
      return updated
    })
  }, [useIPC])

  const reorderSpots = useCallback(async (ids: string[]) => {
    if (useIPC && window.electronAPI?.spots) {
      try {
        const updated = await window.electronAPI.spots.reorder(ids)
        setSpots(updated)
        return
      } catch (err) {
        console.warn('IPC spots:reorder failed:', err)
      }
    }
    // Fallback
    setSpots(prev => {
      const updated = ids.map(id => prev.find(s => s.id === id)!).filter(Boolean)
      saveToStorage(updated)
      return updated
    })
  }, [useIPC])

  return { spots, loading, addSpot, removeSpot, reorderSpots }
}
