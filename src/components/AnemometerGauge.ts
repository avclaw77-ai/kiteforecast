import { useLiveWind }                      from '../hooks/useLiveWind'
import { windRating, ratingColor, dirLabel } from '../types'

interface Props {
  baseWind: number
  baseGust: number
  dir:      number
}

export function AnemometerGauge({ baseWind, baseGust, dir }: Props) {
  const { wind, gust } = useLiveWind(baseWind, baseGust)
  const color  = ratingColor(windRating(wind))
  const angle  = Math.min((wind / 40) * 180, 180)

  const rad  = Math.PI - (angle * Math.PI) / 180
  const tipX = 36 + 26 * Math.cos(rad)
  const tipY = 38 - 26 * Math.sin(rad)
  const arcLen = (angle / 180) * 100

  return (
    <div className="anemometer">
      <svg width={72} height={44} viewBox="0 0 72 44">
        {/* Background arc */}
        <path d="M 4 40 A 32 32 0 0 1 68 40"
          fill="none" stroke="#E8EDF3" strokeWidth={5} strokeLinecap="round" />
        {/* Colored arc */}
        <path d="M 4 40 A 32 32 0 0 1 68 40"
          fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${arcLen} 100`} />
        {/* Needle */}
        <line x1="36" y1="40" x2={tipX} y2={tipY}
          stroke="#1A202C" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx="36" cy="40" r="3.5" fill="#1A202C" />
      </svg>

      <div className="anemometer-wind" style={{ color }}>
        {wind} <span className="anemometer-unit">kts</span>
      </div>
      <div className="anemometer-meta">
        gust {gust} · {dirLabel(dir)}
      </div>
    </div>
  )
}
