import { useState, useEffect } from 'react'
import type { AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const STORAGE_KEY = 'kiteforecast-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  function update(patch: Partial<AppSettings>) {
    setSettings(prev => ({ ...prev, ...patch }))
  }

  return { settings, update }
}
