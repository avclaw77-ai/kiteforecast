// ── Models ────────────────────────────────────────────────────────────────────
export type WindModel = 'GFS' | 'HRRR' | 'NAM' | 'BLEND'

export const ALL_MODELS: WindModel[] = ['GFS', 'HRRR', 'NAM', 'BLEND']
export const BASE_MODELS: WindModel[] = ['GFS', 'HRRR', 'NAM']

// ── Spots ─────────────────────────────────────────────────────────────────────
export interface Spot {
  id: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
  isKnown: boolean
  wind: number
  gust: number
  dir: number
}

// ── Forecast ──────────────────────────────────────────────────────────────────
export interface DayForecast {
  day: string
  date: string
  wind: number
  gust: number
  temp: number
  rain: number
  cloud: number
  tideHigh: number
  tideLow: number
  tideRange: number
  dirDeg: number
  spread?: number
}

export interface HourForecast {
  hour: string
  wind: number
  gust: number
  temp: number
  rain: number
  spread?: number
}

// ── API response shapes (Open-Meteo) ──────────────────────────────────────────
export interface OpenMeteoDailyResponse {
  daily: {
    time:                            string[]
    windspeed_10m_max:               number[]
    windgusts_10m_max:               number[]
    winddirection_10m_dominant:      number[]
    temperature_2m_max:              number[]
    precipitation_sum:               number[]
    cloudcover_mean:                 number[]
  }
}

export interface OpenMeteoHourlyResponse {
  hourly: {
    time:             string[]
    windspeed_10m:    number[]
    windgusts_10m:    number[]
    temperature_2m:   number[]
    precipitation:    number[]
  }
}

// ── Wind rating ───────────────────────────────────────────────────────────────
export type WindRating = 'good' | 'ok' | 'poor'

export function windRating(knots: number): WindRating {
  if (knots >= 15 && knots <= 30) return 'good'
  if ((knots >= 10 && knots < 15) || (knots > 30 && knots <= 35)) return 'ok'
  return 'poor'
}

export function ratingColor(r: WindRating): string {
  return r === 'good' ? '#10B981' : r === 'ok' ? '#F59E0B' : '#EF4444'
}

export function dirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

// ── Window type augmentation ──────────────────────────────────────────────────
import type { ElectronAPI } from '../electron/preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
