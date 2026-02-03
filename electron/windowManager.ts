import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { logService } from './services/logService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

export interface WindowConfig {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  title?: string
  dev?: boolean
}

/**
 * Get the icon path based on environment
 */
export const getIconPath = (): string => {
  return process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, '../public/zhixia-logo.png')
    : path.join(__dirname, '../dist/zhixia-logo.png')
}

/**
 * Get the preload script path
 */
export const getPreloadPath = (): string => {
  return path.join(__dirname, 'preload.js')
}

/**
 * Get the load URL based on environment
 */
export const getLoadURL = (): string => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL
  }
  return path.join(__dirname, '../dist/index.html')
}

/**
 * Create the main application window
 */
export const createMainWindow = (config: WindowConfig = {}): BrowserWindow => {
  // Close existing window if any
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }

  const iconPath = getIconPath()
  logService.log(`Using Icon Path: ${iconPath}`)

  mainWindow = new BrowserWindow({
    width: config.width || 1200,
    height: config.height || 800,
    minWidth: config.minWidth || 1000,
    minHeight: config.minHeight || 600,
    icon: iconPath,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: config.title || '知夏笔记',
    titleBarStyle: 'hiddenInset',
  })

  // Set Dock Icon for macOS
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath)
  }

  const loadURL = getLoadURL()

  if (process.env.VITE_DEV_SERVER_URL) {
    logService.log('Loading Dev Server URL...')
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    logService.log(`Loading File: ${loadURL}`)
    mainWindow.loadFile(loadURL)
  }

  // Open DevTools in development
  if (config.dev !== false && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/**
 * Get the main window instance
 */
export const getMainWindow = (): BrowserWindow | null => {
  return mainWindow
}

/**
 * Check if main window exists and is not destroyed
 */
export const hasMainWindow = (): boolean => {
  return mainWindow !== null && !mainWindow.isDestroyed()
}

/**
 * Focus the main window if it exists
 */
export const focusMainWindow = (): void => {
  if (hasMainWindow() && mainWindow!) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
}

/**
 * Close the main window
 */
export const closeMainWindow = (): void => {
  if (hasMainWindow() && mainWindow!) {
    mainWindow.close()
    mainWindow = null
  }
}

/**
 * Reload the main window
 */
export const reloadMainWindow = (): void => {
  if (hasMainWindow() && mainWindow!) {
    mainWindow.reload()
  }
}

/**
 * Toggle DevTools
 */
export const toggleDevTools = (): void => {
  if (hasMainWindow() && mainWindow!) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    } else {
      mainWindow.webContents.openDevTools()
    }
  }
}
