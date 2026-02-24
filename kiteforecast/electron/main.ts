import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { KNOWN_SPOTS } from '../src/data/knownSpots'
import type { Spot } from '../src/types'

// ── Persistent store ──────────────────────────────────────────────────────────
const store = new Store<{ spots: Spot[] }>({
  defaults: {
    spots: KNOWN_SPOTS.filter(s => ['k1', 'k2', 'k3', 'k4', 'k5'].includes(s.id)),
  },
})

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.kiteforecast')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: spot CRUD ────────────────────────────────────────────────────────────
ipcMain.handle('spots:get', (): Spot[] => {
  return store.get('spots')
})

ipcMain.handle('spots:add', (_, spot: Spot): Spot[] => {
  const current = store.get('spots')
  if (current.find(s => s.id === spot.id)) return current
  const updated = [...current, spot]
  store.set('spots', updated)
  return updated
})

ipcMain.handle('spots:remove', (_, id: string): Spot[] => {
  const updated = store.get('spots').filter(s => s.id !== id)
  store.set('spots', updated)
  return updated
})

ipcMain.handle('spots:reorder', (_, ids: string[]): Spot[] => {
  const current = store.get('spots')
  const updated = ids.map(id => current.find(s => s.id === id)!).filter(Boolean)
  store.set('spots', updated)
  return updated
})
