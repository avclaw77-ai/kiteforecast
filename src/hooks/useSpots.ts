import { useState, useEffect, useCallback } from 'react'
import type { Spot } from '../types'

export function useSpots() {
  const [spots,   setSpots]   = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.spots.get()
      .then(setSpots)
      .finally(() => setLoading(false))
  }, [])

  const addSpot = useCallback(async (spot: Spot) => {
    const updated = await window.electronAPI.spots.add(spot)
    setSpots(updated)
  }, [])

  const removeSpot = useCallback(async (id: string) => {
    const updated = await window.electronAPI.spots.remove(id)
    setSpots(updated)
  }, [])

  const reorderSpots = useCallback(async (ids: string[]) => {
    const updated = await window.electronAPI.spots.reorder(ids)
    setSpots(updated)
  }, [])

  return { spots, loading, addSpot, removeSpot, reorderSpots }
}
