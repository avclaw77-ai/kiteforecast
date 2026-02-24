import { useState, useEffect } from 'react'
import { fetchDailyForecast } from '../api/openmeteo'
import type { DayForecast, WindModel } from '../types'

export function useForecast(lat: number, lng: number, model: WindModel) {
  const [data,    setData]    = useState<DayForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchDailyForecast(lat, lng, model)
      .then(d  => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(()  => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lat, lng, model])

  return { data, loading, error }
}
