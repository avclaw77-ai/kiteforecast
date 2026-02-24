/**
 * Tide data module — optimized for Storm Glass free tier (10 req/day).
 *
 * Key optimizations:
 *  - Only fetches EXTREMES endpoint (not sea-level) → 1 API call per spot
 *  - Sea levels interpolated from extremes via cosine curve
 *  - Cache uses 0.3° grid → nearby spots (e.g. all Québec) share one cache
 *  - In-flight dedup prevents concurrent duplicate requests
 *  - Seed data for dev spots (SAB, Cabarete) → zero API calls
 *  - localStorage persistence → survives app restart within same day
 *
 * Call hierarchy:
 *  - fetchTideData() called ONLY from App.tsx on spot change
 *  - tideAt() / tidePeaks() are sync, use memCache or seed or simulation
 */

import { TIDE_SEEDS } from '../data/tideSeed'

const STORMGLASS_BASE = 'https://api.stormglass.io/v2/tide'

// ── Types ────────────────────────────────────────────────────────────────────
export interface TidePeakInfo {
  hour:  number
  time:  string
  level: number
  type:  'high' | 'low'
}

interface CachedExtreme {
  absHour: number
  level:   number
  type:    'high' | 'low'
}

interface TideCache {
  date:      string
  lat:       number
  lng:       number
  seaLevels: { absHour: number; level: number }[]
  extremes:  CachedExtreme[]
}

// ── State ────────────────────────────────────────────────────────────────────
let memCache: TideCache | null = null
let apiKey = ''
let inflight: Promise<boolean> | null = null
let inflightGrid = ''

export function setStormGlassKey(key: string) { apiKey = key }
export function getStormGlassKey(): string { return apiKey }

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr(): string { return new Date().toISOString().slice(0, 10) }

// 0.3° grid — all Québec spots map to same cell, Cabarete to its own, etc.
function gridKey(lat: number, lng: number): string {
  const gLat = (Math.round(lat / 0.3) * 0.3).toFixed(1)
  const gLng = (Math.round(lng / 0.3) * 0.3).toFixed(1)
  return `tide-${gLat}-${gLng}`
}

// ── Seed data lookup ─────────────────────────────────────────────────────────
function findSeed(lat: number, lng: number): TideCache | null {
  for (const seed of Object.values(TIDE_SEEDS)) {
    if (Math.abs(seed.lat - lat) < 0.2 && Math.abs(seed.lng - lng) < 0.2) {
      return { ...seed, date: todayStr() }
    }
  }
  return null
}

function findSeedByLat(lat: number): TideCache | null {
  for (const seed of Object.values(TIDE_SEEDS)) {
    if (Math.abs(seed.lat - lat) < 0.2) {
      return { ...seed, date: todayStr() }
    }
  }
  return null
}

// ── Cache check — 0.3° tolerance so nearby spots share cache ─────────────────
function cacheCovers(lat: number, lng: number): boolean {
  if (!memCache || memCache.date !== todayStr()) return false
  return Math.abs(memCache.lat - lat) < 0.3 && Math.abs(memCache.lng - lng) < 0.3
}

// Lazy sync cache init for tideAt/tidePeaks (only have lat)
function ensureCache(lat: number): TideCache | null {
  if (memCache && Math.abs(memCache.lat - lat) < 0.3) return memCache
  const seed = findSeedByLat(lat)
  if (seed) { memCache = seed; return seed }
  return null
}

// ── localStorage ─────────────────────────────────────────────────────────────
function loadCache(lat: number, lng: number): TideCache | null {
  try {
    const raw = localStorage.getItem(gridKey(lat, lng))
    if (!raw) return null
    const c: TideCache = JSON.parse(raw)
    if (c.date !== todayStr()) return null
    return c
  } catch { return null }
}

function saveCache(c: TideCache) {
  try { localStorage.setItem(gridKey(c.lat, c.lng), JSON.stringify(c)) }
  catch { /* ignore */ }
}

// ── Main fetch — called ONLY from App.tsx ────────────────────────────────────
export async function fetchTideData(lat: number, lng: number): Promise<boolean> {
  // 1. Memory cache (wide match)
  if (cacheCovers(lat, lng)) return memCache!.seaLevels.length > 0

  // 2. localStorage
  const cached = loadCache(lat, lng)
  if (cached) { memCache = cached; return cached.seaLevels.length > 0 }

  // 3. Seed data
  const seed = findSeed(lat, lng)
  if (seed) { memCache = seed; return true }

  // 4. No API key → simulation
  if (!apiKey) return false

  // 5. In-flight dedup — same grid cell already fetching
  const gk = gridKey(lat, lng)
  if (inflight && inflightGrid === gk) return inflight

  // 6. Fetch — ONLY extremes (1 API call, not 2)
  const doFetch = async (): Promise<boolean> => {
    try {
      const start = new Date()
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      const base = new Date(todayStr() + 'T00:00:00')

      console.log(`[Tide] Storm Glass fetch: ${lat.toFixed(2)}, ${lng.toFixed(2)}`)

      const res = await fetch(
        `${STORMGLASS_BASE}/extremes/point?lat=${lat}&lng=${lng}` +
        `&start=${start.toISOString()}&end=${end.toISOString()}`,
        { headers: { Authorization: apiKey } }
      )

      if (!res.ok) {
        console.warn(`[Tide] Storm Glass HTTP ${res.status}`)
        return false
      }

      const json = await res.json()
      const extremes: CachedExtreme[] = []
      for (const e of json.data || []) {
        const t = new Date(e.time)
        const absHour = (t.getTime() - base.getTime()) / 3600000
        if (absHour >= 0) {
          extremes.push({
            absHour: +absHour.toFixed(3),
            level:   +(e.height ?? 0).toFixed(1),
            type:    e.type === 'high' ? 'high' : 'low',
          })
        }
      }

      // Interpolate hourly sea levels from extremes
      const seaLevels = interpolateFromExtremes(extremes)

      const cache: TideCache = { date: todayStr(), lat, lng, seaLevels, extremes }
      memCache = cache
      saveCache(cache)
      console.log(`[Tide] Cached: ${extremes.length} extremes → ${seaLevels.length} hourly levels`)
      return true
    } catch (err) {
      console.warn('[Tide] Fetch failed:', err)
      return false
    } finally {
      inflight = null
      inflightGrid = ''
    }
  }

  inflightGrid = gk
  inflight = doFetch()
  return inflight
}

// ── Cosine interpolation: extremes → hourly sea levels ───────────────────────
function interpolateFromExtremes(extremes: CachedExtreme[]): { absHour: number; level: number }[] {
  if (extremes.length < 2) return []
  const levels: { absHour: number; level: number }[] = []
  const totalHours = 7 * 24

  for (let h = 0; h < totalHours; h++) {
    let before = extremes[0]
    let after = extremes[extremes.length - 1]
    for (let i = 0; i < extremes.length - 1; i++) {
      if (extremes[i].absHour <= h && extremes[i + 1].absHour >= h) {
        before = extremes[i]
        after = extremes[i + 1]
        break
      }
    }
    const span = after.absHour - before.absHour
    if (span <= 0) {
      levels.push({ absHour: h, level: before.level })
    } else {
      const t = (h - before.absHour) / span
      const cos = (1 - Math.cos(t * Math.PI)) / 2
      levels.push({ absHour: h, level: +(before.level + (after.level - before.level) * cos).toFixed(2) })
    }
  }
  return levels
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC SYNC API — used by charts/components
// ══════════════════════════════════════════════════════════════════════════════

export function tideAt(dayOffset: number, hour: number, lat: number): number {
  const cache = ensureCache(lat)
  if (cache && cache.seaLevels.length > 0) {
    const target = dayOffset * 24 + hour
    let best = cache.seaLevels[0]
    let bestDist = Math.abs(best.absHour - target)
    for (const sl of cache.seaLevels) {
      const d = Math.abs(sl.absHour - target)
      if (d < bestDist) { best = sl; bestDist = d }
    }
    if (bestDist <= 1.5) return best.level
  }
  return +tideRaw(dayOffset, hour, lat).toFixed(2)
}

export function tidePeaks(dayOffset: number, lat: number): TidePeakInfo[] {
  const cache = ensureCache(lat)
  if (cache && cache.extremes.length > 0) {
    const dayStart = dayOffset * 24
    const dayEnd = dayStart + 24
    const results: TidePeakInfo[] = []
    for (const e of cache.extremes) {
      if (e.absHour >= dayStart && e.absHour < dayEnd) {
        const hourInDay = e.absHour - dayStart
        const h = Math.floor(hourInDay)
        const m = Math.round((hourInDay - h) * 60)
        results.push({
          hour: hourInDay,
          time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          level: e.level,
          type: e.type,
        })
      }
    }
    if (results.length > 0) return results
  }
  return simPeaks(dayOffset, lat)
}

export function tideDay(dayOffset: number, lat: number): number[] {
  return Array.from({ length: 24 }, (_, h) => tideAt(dayOffset, h, lat))
}

// ══════════════════════════════════════════════════════════════════════════════
// SIMULATION FALLBACK
// ══════════════════════════════════════════════════════════════════════════════

const LUNAR_SHIFT_RAD    = (50.47 / (24 * 60)) * 2 * Math.PI
const SPRING_NEAP_PERIOD = 14.76

function tideRaw(dayOffset: number, hour: number, lat: number): number {
  const locPhase   = ((lat * 7.3 + 41.7) % 360) * Math.PI / 180
  const lunarPhase = dayOffset * LUNAR_SHIFT_RAD + locPhase
  const dayOfYear  = getDayOfYear() + dayOffset
  const springNeap = 0.5 + 0.5 * Math.cos((dayOfYear / SPRING_NEAP_PERIOD) * 2 * Math.PI)
  const mainAmp    = 1.2 + 0.8 * springNeap
  const diurnalAmp = mainAmp * 0.18
  const MSL = 2.1
  const t  = (hour / 12.42) * 2 * Math.PI + lunarPhase
  const m2 = mainAmp * Math.cos(t)
  const k1 = diurnalAmp * Math.cos((hour / 24) * 2 * Math.PI + lunarPhase * 0.52 + 0.8)
  const m4 = mainAmp * 0.06 * Math.cos(2 * t + 0.4)
  return MSL + m2 + k1 + m4
}

function simPeaks(dayOffset: number, lat: number): TidePeakInfo[] {
  const steps = 240
  const samples: { t: number; v: number }[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 24
    samples.push({ t, v: tideRaw(dayOffset, t, lat) })
  }
  const peaks: TidePeakInfo[] = []
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1].v, cur = samples[i].v, next = samples[i + 1].v
    if (cur > prev && cur > next) peaks.push(makePeak(samples[i].t, cur, 'high'))
    if (cur < prev && cur < next) peaks.push(makePeak(samples[i].t, cur, 'low'))
  }
  return peaks
}

function makePeak(fh: number, level: number, type: 'high' | 'low'): TidePeakInfo {
  const h = Math.floor(fh)
  const m = Math.round((fh - h) * 60)
  return {
    hour: fh,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    level: +level.toFixed(1),
    type,
  }
}

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86400000)
}
