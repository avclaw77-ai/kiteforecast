import type {
  DayForecast, HourForecast, WindModel,
  OpenMeteoDailyResponse, OpenMeteoHourlyResponse,
} from '../types'
import { BASE_MODELS } from '../types'

const BASE_URL   = 'https://api.open-meteo.com/v1/forecast'
const KMH_TO_KTS = 0.539957

const MODEL_ID: Record<string, string> = {
  GFS:  'gfs_seamless',
  HRRR: 'gfs_hrrr',
  NAM:  'nam_conus',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Cache ─────────────────────────────────────────────────────────────────────
const dailyCache  = new Map<string, { ts: number; data: DayForecast[] }>()
const hourlyCache = new Map<string, { ts: number; data: HourForecast[] }>()
const CACHE_TTL   = 15 * 60 * 1000   // 15 minutes

function key(...parts: (string | number)[]): string {
  return parts.join('|')
}

// ── Daily ─────────────────────────────────────────────────────────────────────
export async function fetchDailyForecast(
  lat: number,
  lng: number,
  model: WindModel,
): Promise<DayForecast[]> {
  if (model === 'BLEND') {
    const results = await Promise.all(
      BASE_MODELS.map(m => fetchDailyForecast(lat, lng, m))
    )
    return results[0].map((d, i) => {
      const winds = results.map(r => r[i].wind)
      const gusts = results.map(r => r[i].gust)
      return {
        ...d,
        wind:   Math.round(winds.reduce((a, b) => a + b, 0) / results.length),
        gust:   Math.round(gusts.reduce((a, b) => a + b, 0) / results.length),
        temp:   Math.round(results.map(r => r[i].temp).reduce((a, b) => a + b, 0) / results.length),
        rain:   Math.round(results.map(r => r[i].rain).reduce((a, b) => a + b, 0) / results.length),
        spread: Math.max(...winds) - Math.min(...winds),
      }
    })
  }

  const k   = key(lat, lng, model, 'daily')
  const hit = dailyCache.get(k)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data

  const url = new URL(BASE_URL)
  url.searchParams.set('latitude',      String(lat))
  url.searchParams.set('longitude',     String(lng))
  url.searchParams.set('models',        MODEL_ID[model])
  url.searchParams.set('daily', [
    'windspeed_10m_max',
    'windgusts_10m_max',
    'winddirection_10m_dominant',
    'temperature_2m_max',
    'precipitation_sum',
    'cloudcover_mean',
  ].join(','))
  url.searchParams.set('timezone',      'auto')
  url.searchParams.set('forecast_days', '7')

  const res  = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const json = await res.json() as OpenMeteoDailyResponse
  const d    = json.daily

  const data: DayForecast[] = d.time.map((date, i) => ({
    day:       DAYS[i % 7],
    date,
    wind:      Math.round((d.windspeed_10m_max[i]             ?? 0) * KMH_TO_KTS),
    gust:      Math.round((d.windgusts_10m_max[i]             ?? 0) * KMH_TO_KTS),
    dirDeg:     d.winddirection_10m_dominant[i]               ?? 0,
    temp:      Math.round( d.temperature_2m_max[i]            ?? 0),
    rain:      Math.round((d.precipitation_sum[i]             ?? 0) * 10) / 10,
    cloud:     Math.round( d.cloudcover_mean[i]               ?? 0),
    tideHigh:  (6   + i * 0.8) % 12,
    tideLow:   (0.5 + i * 0.8) % 12,
    tideRange: 1.8,
  }))

  dailyCache.set(k, { ts: Date.now(), data })
  return data
}

// ── Hourly ────────────────────────────────────────────────────────────────────
export async function fetchHourlyForecast(
  lat: number,
  lng: number,
  model: WindModel,
  dayOffset: number,
): Promise<HourForecast[]> {
  if (model === 'BLEND') {
    const results = await Promise.all(
      BASE_MODELS.map(m => fetchHourlyForecast(lat, lng, m, dayOffset))
    )
    return results[0].map((h, i) => {
      const winds = results.map(r => r[i].wind)
      return {
        ...h,
        wind:   Math.round(winds.reduce((a, b) => a + b, 0) / results.length),
        gust:   Math.round(results.map(r => r[i].gust).reduce((a, b) => a + b, 0) / results.length),
        temp:   Math.round(results.map(r => r[i].temp).reduce((a, b) => a + b, 0) / results.length * 10) / 10,
        rain:   Math.round(results.map(r => r[i].rain).reduce((a, b) => a + b, 0) / results.length * 10) / 10,
        spread: Math.max(...winds) - Math.min(...winds),
      }
    })
  }

  const k   = key(lat, lng, model, 'hourly', dayOffset)
  const hit = hourlyCache.get(k)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data

  const url = new URL(BASE_URL)
  url.searchParams.set('latitude',      String(lat))
  url.searchParams.set('longitude',     String(lng))
  url.searchParams.set('models',        MODEL_ID[model])
  url.searchParams.set('hourly', [
    'windspeed_10m',
    'windgusts_10m',
    'temperature_2m',
    'precipitation',
  ].join(','))
  url.searchParams.set('timezone',      'auto')
  url.searchParams.set('forecast_days', '7')

  const res  = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const json = await res.json() as OpenMeteoHourlyResponse
  const h    = json.hourly

  const start = dayOffset * 24
  const data: HourForecast[] = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    wind: Math.round((h.windspeed_10m[start + i]  ?? 0) * KMH_TO_KTS),
    gust: Math.round((h.windgusts_10m[start + i]  ?? 0) * KMH_TO_KTS),
    temp:             h.temperature_2m[start + i]  ?? 0,
    rain:             h.precipitation[start + i]   ?? 0,
  }))

  hourlyCache.set(k, { ts: Date.now(), data })
  return data
}

// ── Cache control ─────────────────────────────────────────────────────────────
export function clearForecastCache(): void {
  dailyCache.clear()
  hourlyCache.clear()
}
