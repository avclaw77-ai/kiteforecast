import { useState, useEffect } from 'react'
import { KNOWN_SPOTS } from '../data/knownSpots'

type LiveWindMap = Record<string, { wind: number; gust: number }>

export function useMapLiveWinds(): LiveWindMap {
  const [winds, setWinds] = useState<LiveWindMap>(() => {
    const init: LiveWindMap = {}
    KNOWN_SPOTS.forEach(s => { init[s.id] = { wind: s.wind, gust: s.gust } })
    return init
  })

  useEffect(() => {
    const iv = setInterval(() => {
      setWinds(prev => {
        const next = { ...prev }
        KNOWN_SPOTS.forEach(s => {
          next[s.id] = {
            wind: Math.max(2, s.wind + Math.round((Math.random() - 0.5) * 4)),
            gust: Math.max(4, s.gust + Math.round((Math.random() - 0.5) * 5)),
          }
        })
        return next
      })
    }, 2000)
    return () => clearInterval(iv)
  }, [])

  return winds
}
