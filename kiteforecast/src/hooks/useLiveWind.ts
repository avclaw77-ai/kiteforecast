import { useState, useEffect } from 'react'

interface LiveWind {
  wind: number
  gust: number
}

export function useLiveWind(baseWind: number, baseGust: number): LiveWind {
  const [live, setLive] = useState<LiveWind>({ wind: baseWind, gust: baseGust })

  useEffect(() => {
    const iv = setInterval(() => {
      setLive({
        wind: Math.max(2, baseWind + Math.round((Math.random() - 0.5) * 4)),
        gust: Math.max(4, baseGust + Math.round((Math.random() - 0.5) * 5)),
      })
    }, 1800)
    return () => clearInterval(iv)
  }, [baseWind, baseGust])

  return live
}
