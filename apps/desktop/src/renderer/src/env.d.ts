/// <reference types="vite/client" />

import type { SavePayload } from '@vida/persistence-engine'

declare global {
  interface ElectronAPI {
    platform: string
    saveVida: (data: SavePayload) => Promise<boolean>
    loadVida: () => Promise<SavePayload | null>
    clearVida: () => Promise<boolean>
    getVersion: () => Promise<string>
    minimizeVida: () => Promise<void>
    setSidebar: (visible: boolean) => Promise<void>
    quitVida: () => Promise<void>
  }

  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
