import type { DayForecast, HourForecast, WindModel } from '../types'
import { BASE_MODELS } from '../types'
import { tideAt } from './tide'

const KMH_TO_KTS = 0.539957

// ── Model endpoints ──────────────────────────────────────────────────────────
const MODEL_URL: Record<string, string> = {
  GFS:   'https://api.open-meteo.com/v1/gfs',
  ECMWF: 'https://api.open-meteo.com/v1/ecmwf',
  ICON:  'https://api.open-meteo.com/v1/dwd-icon',
  MF:    'https://api.open-meteo.com/v1/meteofrance',
  GEM:   'https://api.open-meteo.com/v1/gem',
}

// ── Model weights ────────────────────────────────────────────────────────────
// Based on general NWP skill scores. ECMWF (IFS) is widely regarded as the
// most skilful global model; GFS and ICON are strong runners-up; MF (ARPEGE)
// and GEM are solid but slightly lower resolution or skill at longer range.
// These are default weights — a production system would adapt them per-region.
const MODEL_WEIGHT: Record<string, number> = {
  ECMWF: 1.3,
  GFS:   1.0,
  ICON:  1.1,
  MF:    0.85,
  GEM:   0.8,
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Cache ────────────────────────────────────────────────────────────────────
const dailyCache  = new Map<string, { ts: number; data: DayForecast[] }>()
const hourlyCache = new Map<string, { ts: number; data: HourForecast[] }>()
const CACHE_TTL   = 15 * 60 * 1000

function ck(...p: (string | number)[]): string { return p.join('|') }

// ══════════════════════════════════════════════════════════════════════════════
// BLEND UTILITIES — meteorological best practices for multi-model ensembles
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Circular mean for wind direction (degrees).
 * Simple arithmetic averaging breaks at the 0°/360° boundary
 * (e.g. avg(350°, 10°) = 180° instead of 0°).
 * Circular mean converts to unit vectors, averages, then converts back.
 */
function circularMeanDeg(angles: number[], weights: number[]): number {
  let sumSin = 0, sumCos = 0, sumW = 0
  for (let i = 0; i < angles.length; i++) {
    const rad = angles[i] * Math.PI / 180
    sumSin += Math.sin(rad) * weights[i]
    sumCos += Math.cos(rad) * weights[i]
    sumW += weights[i]
  }
  let mean = Math.atan2(sumSin / sumW, sumCos / sumW) * 180 / Math.PI
  if (mean < 0) mean += 360
  return Math.round(mean)
}

/**
 * Circular spread (concentration) for wind direction.
 * Returns a value 0–1 where 1 = all models agree perfectly.
 * Based on the mean resultant length (R-bar) of circular statistics.
 */
function circularConcentration(angles: number[]): number {
  const n = angles.length
  if (n <= 1) return 1
  let sumSin = 0, sumCos = 0
  for (const a of angles) {
    const rad = a * Math.PI / 180
    sumSin += Math.sin(rad)
    sumCos += Math.cos(rad)
  }
  return Math.sqrt(sumSin * sumSin + sumCos * sumCos) / n
}

/**
 * Weighted mean with optional outlier rejection.
 * If N >= 4, drops the value furthest from the initial weighted mean
 * (trimmed weighted mean). This prevents a single rogue model from
 * pulling the blend too far.
 */
function blendValues(
  values: number[],
  modelNames: string[],
  trim = true,
): { mean: number; spread: number; confidence: number } {
  const n = values.length
  if (n === 0) return { mean: 0, spread: 0, confidence: 0 }
  if (n === 1) return { mean: values[0], spread: 0, confidence: 0.5 }

  const weights = modelNames.map(m => MODEL_WEIGHT[m] ?? 1.0)

  // Initial weighted mean
  let sumW = 0, sumV = 0
  for (let i = 0; i < n; i++) { sumV += values[i] * weights[i]; sumW += weights[i] }
  const initialMean = sumV / sumW

  // Outlier rejection: if N >= 4, drop the model furthest from mean
  let useIdx = values.map((_, i) => i)
  if (trim && n >= 4) {
    let maxDist = 0, maxIdx = 0
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(values[i] - initialMean)
      if (dist > maxDist) { maxDist = dist; maxIdx = i }
    }
    useIdx = useIdx.filter(i => i !== maxIdx)
  }

  // Final weighted mean
  sumW = 0; sumV = 0
  for (const i of useIdx) { sumV += values[i] * weights[i]; sumW += weights[i] }
  const mean = sumV / sumW

  // Spread = full range across ALL models (before trimming)
  const spread = Math.max(...values) - Math.min(...values)

  // Confidence: based on coefficient of variation (CV)
  // Low spread relative to mean = high confidence
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  const cv = mean > 0 ? std / mean : std
  // Map CV to 0–1 confidence: CV=0 → 1.0, CV≥0.5 → 0.0
  const confidence = Math.max(0, Math.min(1, 1 - cv * 2))

  return { mean, spread, confidence }
}

/**
 * Classify model agreement level for display.
 */
function agreementLabel(confidence: number): string {
  if (confidence >= 0.75) return 'high'
  if (confidence >= 0.45) return 'moderate'
  return 'low'
}

// ══════════════════════════════════════════════════════════════════════════════
// DAILY FORECAST
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchDailyForecast(
  lat: number, lng: number, model: WindModel,
): Promise<DayForecast[]> {

  if (model === 'BLEND') {
    const results = await Promise.allSettled(
      BASE_MODELS.map(m => fetchDailyForecast(lat, lng, m))
    )
    const succeeded: { model: string; data: DayForecast[] }[] = []
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') succeeded.push({ model: BASE_MODELS[idx], data: r.value })
    })
    if (!succeeded.length) throw new Error('All models failed')

    const modelNames = succeeded.map(s => s.model)
    const N = succeeded[0].data.length

    return succeeded[0].data.map((d, i) => {
      const winds  = succeeded.map(s => s.data[i]?.wind ?? 0)
      const gusts  = succeeded.map(s => s.data[i]?.gust ?? 0)
      const temps  = succeeded.map(s => s.data[i]?.temp ?? 0)
      const rains  = succeeded.map(s => s.data[i]?.rain ?? 0)
      const dirs   = succeeded.map(s => s.data[i]?.dirDeg ?? 0)
      const weights = modelNames.map(m => MODEL_WEIGHT[m] ?? 1.0)

      const windBlend = blendValues(winds, modelNames)
      const gustBlend = blendValues(gusts, modelNames)
      const tempBlend = blendValues(temps, modelNames, false)  // no trim for temp
      const rainBlend = blendValues(rains, modelNames, false)  // no trim for rain

      // Circular mean for wind direction
      const dirBlend = circularMeanDeg(dirs, weights)

      // Overall confidence: weighted average of wind confidence and direction agreement
      const dirConf = circularConcentration(dirs)
      const overallConf = windBlend.confidence * 0.6 + dirConf * 0.4

      return {
        ...d,
        wind:           Math.round(windBlend.mean),
        gust:           Math.round(gustBlend.mean),
        temp:           Math.round(tempBlend.mean),
        rain:           Math.round(rainBlend.mean * 10) / 10,
        dirDeg:         dirBlend,
        spread:         windBlend.spread,
        confidence:     Math.round(overallConf * 100) / 100,
        modelAgreement: agreementLabel(overallConf),
      }
    })
  }

  // ── Single model fetch ───────────────────────────────────────────────────
  const k = ck(lat, lng, model, 'd')
  const hit = dailyCache.get(k)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data

  const base = MODEL_URL[model]
  if (!base) throw new Error(`Unknown model: ${model}`)

  const url = new URL(base)
  url.searchParams.set('latitude',      String(lat))
  url.searchParams.set('longitude',     String(lng))
  url.searchParams.set('daily',
    'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,temperature_2m_max,precipitation_sum')
  url.searchParams.set('timezone',      'auto')
  url.searchParams.set('forecast_days', '7')

  const res  = await fetch(url.toString())
  if (!res.ok) throw new Error(`${model}: ${res.status}`)
  const json = await res.json()
  const d    = json.daily ?? {}

  const time = d.time                          ?? []
  const ws   = d.wind_speed_10m_max            ?? d.windspeed_10m_max          ?? []
  const wg   = d.wind_gusts_10m_max            ?? d.windgusts_10m_max          ?? []
  const wd   = d.wind_direction_10m_dominant    ?? d.winddirection_10m_dominant ?? []
  const t2   = d.temperature_2m_max            ?? []
  const pr   = d.precipitation_sum             ?? []

  const data: DayForecast[] = time.map((date: string, i: number) => ({
    day:       DAY_NAMES[new Date(date + 'T00:00:00').getDay()],
    date,
    wind:      Math.round((ws[i] ?? 0) * KMH_TO_KTS),
    gust:      Math.round((wg[i] ?? 0) * KMH_TO_KTS),
    dirDeg:    wd[i] ?? 0,
    temp:      Math.round(t2[i] ?? 0),
    rain:      Math.round((pr[i] ?? 0) * 10) / 10,
    cloud:     0,
    tideHigh:  0,    // legacy fields — peaks now computed from tideAt()
    tideLow:   0,
    tideRange: 0,
  }))

  dailyCache.set(k, { ts: Date.now(), data })
  return data
}

// ══════════════════════════════════════════════════════════════════════════════
// HOURLY FORECAST
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchHourlyForecast(
  lat: number, lng: number, model: WindModel, dayOff: number,
): Promise<HourForecast[]> {

  if (model === 'BLEND') {
    const results = await Promise.allSettled(
      BASE_MODELS.map(m => fetchHourlyForecast(lat, lng, m, dayOff))
    )
    const succeeded: { model: string; data: HourForecast[] }[] = []
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') succeeded.push({ model: BASE_MODELS[idx], data: r.value })
    })
    if (!succeeded.length) throw new Error('All models failed')

    const modelNames = succeeded.map(s => s.model)

    return succeeded[0].data.map((h, i) => {
      const winds  = succeeded.map(s => s.data[i]?.wind ?? 0)
      const gusts  = succeeded.map(s => s.data[i]?.gust ?? 0)
      const temps  = succeeded.map(s => s.data[i]?.temp ?? 0)
      const rains  = succeeded.map(s => s.data[i]?.rain ?? 0)
      const dirs   = succeeded.map(s => s.data[i]?.dirDeg ?? 0)
      const weights = modelNames.map(m => MODEL_WEIGHT[m] ?? 1.0)

      const windBlend = blendValues(winds, modelNames)
      const gustBlend = blendValues(gusts, modelNames)
      const tempBlend = blendValues(temps, modelNames, false)
      const rainBlend = blendValues(rains, modelNames, false)
      const dirBlend  = circularMeanDeg(dirs, weights)

      const dirConf     = circularConcentration(dirs)
      const overallConf = windBlend.confidence * 0.6 + dirConf * 0.4

      return {
        ...h,
        wind:       Math.round(windBlend.mean),
        gust:       Math.round(gustBlend.mean),
        temp:       Math.round(tempBlend.mean * 10) / 10,
        rain:       Math.round(rainBlend.mean * 10) / 10,
        dirDeg:     dirBlend,
        tide:       succeeded[0].data[i]?.tide ?? h.tide,
        spread:     windBlend.spread,
        confidence: Math.round(overallConf * 100) / 100,
      }
    })
  }

  // ── Single model fetch ───────────────────────────────────────────────────
  const k   = ck(lat, lng, model, 'h', dayOff)
  const hit = hourlyCache.get(k)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data

  const base = MODEL_URL[model]
  if (!base) throw new Error(`Unknown model: ${model}`)

  const url = new URL(base)
  url.searchParams.set('latitude',      String(lat))
  url.searchParams.set('longitude',     String(lng))
  url.searchParams.set('hourly',
    'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation')
  url.searchParams.set('timezone',      'auto')
  url.searchParams.set('forecast_days', '7')

  const res  = await fetch(url.toString())
  if (!res.ok) throw new Error(`${model}: ${res.status}`)
  const json = await res.json()
  const h    = json.hourly ?? {}

  const ws = h.wind_speed_10m     ?? h.windspeed_10m      ?? []
  const wg = h.wind_gusts_10m     ?? h.windgusts_10m      ?? []
  const wd = h.wind_direction_10m ?? h.winddirection_10m  ?? []
  const t2 = h.temperature_2m     ?? []
  const pr = h.precipitation      ?? []

  const s  = dayOff * 24
  const data: HourForecast[] = Array.from({ length: 24 }, (_, i) => ({
    hour:   `${String(i).padStart(2, '0')}:00`,
    wind:   Math.round((ws[s + i] ?? 0) * KMH_TO_KTS),
    gust:   Math.round((wg[s + i] ?? 0) * KMH_TO_KTS),
    dirDeg: wd[s + i] ?? 0,
    temp:   t2[s + i] ?? 0,
    rain:   pr[s + i] ?? 0,
    tide:   tideAt(dayOff, i, lat),
  }))

  hourlyCache.set(k, { ts: Date.now(), data })
  return data
}

// ── Cache control ────────────────────────────────────────────────────────────
export function clearForecastCache(): void {
  dailyCache.clear()
  hourlyCache.clear()
}
