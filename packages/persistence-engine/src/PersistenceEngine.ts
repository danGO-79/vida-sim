import type { SaveData } from './types'

export type SavePayload = SaveData

export class PersistenceEngine {
  private _api: ElectronAPI | null = null

  setAPI(api: ElectronAPI): void {
    this._api = api
  }

  async save(data: SavePayload): Promise<boolean> {
    if (!this._api?.saveVida) return false
    try {
      return await this._api.saveVida(data)
    } catch {
      return false
    }
  }

  async load(): Promise<SavePayload | null> {
    if (!this._api?.loadVida) return null
    try {
      return await this._api.loadVida()
    } catch {
      return null
    }
  }

  async clear(): Promise<boolean> {
    if (!this._api?.clearVida) return false
    try {
      return await this._api.clearVida()
    } catch {
      return false
    }
  }
}

export interface ElectronAPI {
  saveVida: (data: SavePayload) => Promise<boolean>
  loadVida: () => Promise<SavePayload | null>
  clearVida: () => Promise<boolean>
}
