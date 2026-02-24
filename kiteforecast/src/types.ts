// ── Models ────────────────────────────────────────────────────────────────────
export type WindModel = 'GFS' | 'ECMWF' | 'ICON' | 'MF' | 'GEM' | 'BLEND'

export const ALL_MODELS: WindModel[] = ['GFS', 'ECMWF', 'ICON', 'MF', 'GEM', 'BLEND']
export const BASE_MODELS: WindModel[] = ['GFS', 'ECMWF', 'ICON', 'MF', 'GEM']

// ── Settings ──────────────────────────────────────────────────────────────────
export type SpeedUnit = 'kts' | 'mph' | 'km/h'
export type HeightUnit = 'm' | 'ft'
export type TempUnit   = '°C' | '°F'

export interface AppSettings {
  enabledModels:  WindModel[]
  speedUnit:      SpeedUnit
  heightUnit:     HeightUnit
  tempUnit:       TempUnit
  stormGlassKey:  string       // Storm Glass API key for real tide data
}

export const DEFAULT_SETTINGS: AppSettings = {
  enabledModels: ['GFS', 'ECMWF', 'ICON', 'MF', 'GEM', 'BLEND'],
  speedUnit:     'kts',
  heightUnit:    'm',
  tempUnit:      '°C',
  stormGlassKey: 'c30e28ee-11a9-11f1-a997-0242ac120004-c30e2998-11a9-11f1-a997-0242ac120004',
}

// ── Unit conversion helpers ──────────────────────────────────────────────────
export function convertSpeed(kts: number, unit: SpeedUnit): number {
  if (unit === 'mph')  return Math.round(kts * 1.15078)
  if (unit === 'km/h') return Math.round(kts * 1.852)
  return kts  // kts
}

export function convertHeight(metres: number, unit: HeightUnit): number {
  if (unit === 'ft') return +(metres * 3.28084).toFixed(1)
  return +metres.toFixed(1)
}

export function convertTemp(celsius: number, unit: TempUnit): number {
  if (unit === '°F') return Math.round(celsius * 9 / 5 + 32)
  return Math.round(celsius)
}

export function speedLabel(unit: SpeedUnit): string {
  return unit
}

export function heightLabel(unit: HeightUnit): string {
  return unit
}

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
  confidence?: number        // 0–1 model agreement score
  modelAgreement?: string    // 'high' | 'moderate' | 'low'
}

export interface HourForecast {
  hour: string
  wind: number
  gust: number
  temp: number
  rain: number
  dirDeg: number
  tide: number
  spread?: number
  confidence?: number
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
    time:                string[]
    windspeed_10m:       number[]
    windgusts_10m:       number[]
    winddirection_10m:   number[]
    temperature_2m:      number[]
    precipitation:       number[]
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
