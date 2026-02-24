import { useState, useEffect } from 'react'
import { fetchHourlyForecast } from '../api/openmeteo'
import type { HourForecast, WindModel } from '../types'

export function useHourlyForecast(
  lat: number,
  lng: number,
  model: WindModel,
  dayOffset: number | null,
) {
  const [data,    setData]    = useState<HourForecast[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (dayOffset === null) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchHourlyForecast(lat, lng, model, dayOffset)
      .then(d  => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(()  => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lat, lng, model, dayOffset])

  return { data, loading, error }
}
