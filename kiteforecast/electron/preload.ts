import { contextBridge, ipcRenderer } from 'electron'
import type { Spot } from '../src/types'

const api = {
  spots: {
    get:     ():               Promise<Spot[]> => ipcRenderer.invoke('spots:get'),
    add:     (spot: Spot):     Promise<Spot[]> => ipcRenderer.invoke('spots:add', spot),
    remove:  (id: string):    Promise<Spot[]> => ipcRenderer.invoke('spots:remove', id),
    reorder: (ids: string[]): Promise<Spot[]> => ipcRenderer.invoke('spots:reorder', ids),
  },
} as const

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
