import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import path from 'path'
import fs from 'fs'

app.setName('Vida')

const SAVE_FILE = 'vida-save.json'
const APP_VERSION = '0.6.0'
const RESOURCES_DIR = path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../../'), 'resources')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function getSavePath(): string {
  return path.join(app.getPath('userData'), SAVE_FILE)
}

function ensureSaveDir(): void {
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function loadSaveData(): unknown {
  const savePath = getSavePath()
  try {
    if (fs.existsSync(savePath)) {
      const raw = fs.readFileSync(savePath, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error('Error loading save:', err)
    try {
      const backupPath = savePath + '.bak'
      if (fs.existsSync(backupPath)) {
        const raw = fs.readFileSync(backupPath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {}
  }
  return null
}

function saveSaveData(data: unknown): boolean {
  const savePath = getSavePath()
  try {
    ensureSaveDir()
    if (fs.existsSync(savePath)) {
      const bakPath = savePath + '.bak'
      try { fs.copyFileSync(savePath, bakPath) } catch {}
    }
    fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Error saving:', err)
    return false
  }
}

function clearSaveData(): boolean {
  const savePath = getSavePath()
  try {
    if (fs.existsSync(savePath)) {
      const bakPath = savePath + '.bak'
      try { fs.copyFileSync(savePath, bakPath) } catch {}
      fs.unlinkSync(savePath)
    }
    return true
  } catch {
    return false
  }
}

function createTrayIcon(): void {
  const trayIconPath = path.join(RESOURCES_DIR, 'tray-icon.png')
  let icon: Electron.NativeImage
  if (fs.existsSync(trayIconPath)) {
    icon = nativeImage.createFromPath(trayIconPath)
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true)
    }
  } else {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)
  tray.setToolTip('Vida - Organismo Digital')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    icon: path.join(RESOURCES_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    tray?.destroy()
    tray = null
    app.quit()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIPC(): void {
  ipcMain.handle('vida:save', (_event, data: unknown): boolean => {
    return saveSaveData(data)
  })

  ipcMain.handle('vida:load', (): unknown => {
    return loadSaveData()
  })

  ipcMain.handle('vida:clear', (): boolean => {
    return clearSaveData()
  })

  ipcMain.handle('vida:version', (): string => {
    return APP_VERSION
  })

  ipcMain.handle('vida:minimize', (): void => {
    mainWindow?.minimize()
  })

  ipcMain.handle('vida:setSidebar', (_event, visible: boolean): void => {
    if (!mainWindow) return
    const w = visible ? 500 : 400
    mainWindow.setResizable(true)
    mainWindow.setSize(w, 400)
    mainWindow.setResizable(false)
  })

  ipcMain.handle('vida:quit', (): void => {
    mainWindow?.close()
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const dockIconPath = path.join(RESOURCES_DIR, 'icon.png')
    if (fs.existsSync(dockIconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(dockIconPath))
    }
  }
  registerIPC()
  createWindow()
  createTrayIcon()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (mainWindow?.isMinimized()) {
    mainWindow.restore()
  }
})
