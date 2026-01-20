import { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net, globalShortcut } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs' // Changed to fs for sync logging
import fsPromises from 'fs/promises'
import { configService } from './services/configService'
import { fileService } from './services/fileService'
import { gitService } from './services/gitService'
import { cryptoService } from './services/cryptoService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Logging Setup ---
const logPath = path.join(app.getPath('home'), 'Desktop', 'zhixia_debug.log');

try {
    fs.writeFileSync(logPath, `\n\n--- Session Start: ${new Date().toISOString()} ---\n`);
} catch {
    // Ignore log error
}

function log(msg: string) {
    try {
        console.log(msg);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch {
        // Ignore
    }
}

log(`App Path: ${app.getAppPath()}`);
log(`UserData Path: ${app.getPath('userData')}`);
log(`Log Path: ${logPath}`);

// Register Privileged Schemes
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
])

// Disable hardware acceleration
app.disableHardwareAcceleration()

// Set App Name for macOS Menu
app.setName('知夏笔记')

const createMenu = () => {
  const isMac = process.platform === 'darwin'

  const template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [
              { role: 'close' }
            ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://electronjs.org')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template as unknown as Electron.MenuItemConstructorOptions[])
  Menu.setApplicationMenu(menu)
}

const createWindow = () => {
  const iconPath = process.env.VITE_DEV_SERVER_URL 
    ? path.join(__dirname, '../public/zhixia-logo.png')
    : path.join(__dirname, '../dist/zhixia-logo.png');

  log(`Using Icon Path: ${iconPath}`);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // SECURITY: Disable Node integration
      contextIsolation: true, // SECURITY: Enable Context Isolation
      sandbox: false, // We need some access via preload
    },
    title: '知夏笔记',
    titleBarStyle: 'hiddenInset', // macOS style
  })

  // Set Dock Icon for macOS Dev
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    log('Loading Dev Server URL...');
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Open DevTools immediately in production to capture any loading errors
    // log('Opening DevTools (Detach Mode)...');
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
    
    const indexHtmlPath = path.join(__dirname, '../dist/index.html');
    log(`Loading File: ${indexHtmlPath}`);
    
    // Check if file exists
    try {
        if (!fs.existsSync(indexHtmlPath)) {
            log(`ERROR: Index file not found at ${indexHtmlPath}`);
            dialog.showErrorBox('Missing Resource', `Index file not found at ${indexHtmlPath}`);
        }
    } catch (e) {
        log(`Error checking index file: ${e}`);
    }

    mainWindow.loadFile(indexHtmlPath)
      .then(() => {
          log('loadFile promise resolved (page loaded successfully or failed with error page)');
      })
      .catch(e => {
         const errMsg = `Failed to load index.html: ${e.message}\nPath: ${indexHtmlPath}`;
         log(errMsg);
         dialog.showErrorBox('Load Error', errMsg);
      })
  }

  mainWindow.webContents.on('did-finish-load', () => {
      log('webContents did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      log(`webContents did-fail-load: ${errorCode} ${errorDescription}`);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
      log(`RENDERER CRASHED: ${details.reason}, exitCode: ${details.exitCode}`);
      dialog.showErrorBox('Renderer Crashed', `Reason: ${details.reason}\nExit Code: ${details.exitCode}`);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Window Controls
  ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:close', () => mainWindow.close())
}

// --- IPC Handlers ---

// Dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  return { success: true, data: result };
});

ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options?.filters || []
  });
  return { success: true, data: result };
});

// Config
ipcMain.handle('config:get', async () => {
  try {
    return { success: true, data: await configService.getConfig() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('config:save', async (_, config) => {
  try {
    return { success: true, data: await configService.saveConfig(config) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// File
ipcMain.handle('file:getTree', async () => {
  try {
    return { success: true, data: await fileService.getFileTree() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:read', async (_, filePath) => {
  try {
    return { success: true, data: await fileService.readFile(filePath) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:save', async (_, filePath, content) => {
  try {
    await fileService.saveFile(filePath, content)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:create', async (_, parentPath, name) => {
  try {
    return { success: true, data: await fileService.createFile(parentPath, name) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:createDir', async (_, parentPath, name) => {
  try {
    return { success: true, data: await fileService.createDirectory(parentPath, name) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:delete', async (_, filePath) => {
  try {
    await fileService.deleteItem(filePath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:rename', async (_, oldPath, newName) => {
  try {
    await fileService.renameItem(oldPath, newName)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:copyToAssets', async (_, sourcePath, currentMdPath) => {
  try {
    return { success: true, data: await fileService.copyToAssets(sourcePath, currentMdPath) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

const processHtmlContent = async (htmlContent: string) => {
  // Use regex to find img src="media://..."
  // This is a simple regex, might need more robustness for complex HTML
  // But for marked output, it's usually predictable
  const regex = /<img[^>]+src="media:\/\/([^"]+)"/g;
  let processedHtml = htmlContent;
  
  // We need to collect all replacements first to avoid index issues if we replace in place?
  // Actually string.replace with async callback is tricky.
  // Let's use a different approach: find all matches, process them, then replace.
  
  const matches = [...htmlContent.matchAll(regex)];
  
  for (const match of matches) {
    const mediaPath = match[1]; // The part after media://
    
    try {
      // Decode path
      const decodedPath = decodeURIComponent(mediaPath);
      // media:// usually has the full absolute path after it in our implementation?
      // In main.ts protocol handler: const filePath = parsedUrl.pathname
      // In Preview.tsx: src={`media://${encodedPath}...`}
      // So mediaPath is likely "/Users/..." or "C:/Users/..."
      
      let localPath = decodedPath;
      // Handle Windows path issues if any (e.g. leading slash)
      if (process.platform === 'win32' && localPath.startsWith('/') && /^\/[a-zA-Z]:/.test(localPath)) {
        localPath = localPath.slice(1);
      }
      
      const fileBuffer = await fsPromises.readFile(localPath);
      const base64 = fileBuffer.toString('base64');
      const ext = path.extname(localPath).slice(1);
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      
      const newSrc = `data:${mimeType};base64,${base64}`;
      
      // Replace only the src attribute value
      // The regex match[0] includes <img ... src="media://..."
      // We just want to replace media://... with data:...
      // Let's replace the specific string instance
      processedHtml = processedHtml.replace(`src="media://${mediaPath}"`, `src="${newSrc}"`);
      
    } catch (e) {
      log(`Failed to embed image: ${mediaPath} ${e}`);
      // Keep original src if failed
    }
  }
  
  return processedHtml;
};

ipcMain.handle('file:exportHtml', async (_, content, defaultPath) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    if (filePath) {
      const finalContent = await processHtmlContent(content);
      await fsPromises.writeFile(filePath, finalContent);
      return { success: true, data: filePath };
    }
    return { success: false, error: 'Canceled' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('file:exportPdf', async (_, htmlContent, defaultPath) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    
    if (filePath) {
      // Process images to base64 for PDF too, to ensure they load
      const finalContent = await processHtmlContent(htmlContent);
      
      const win = new BrowserWindow({ show: false });
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalContent)}`);
      
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: 0.4, // inches, approx 10mm
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        }
      });
      await fsPromises.writeFile(filePath, pdfData);
      win.close();
      return { success: true, data: filePath };
    }
    return { success: false, error: 'Canceled' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Git
ipcMain.handle('git:status', async () => {
  try {
    return { success: true, data: await gitService.getStatus() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('git:commit', async (_, message) => {
  try {
    await gitService.commit(message)
    return { success: true, data: await gitService.getStatus() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('git:sync', async () => {
  try {
    await gitService.pull()
    await gitService.push()
    return { success: true, data: await gitService.getStatus() }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('git:clone', async (_, url, targetPath) => {
  try {
    const finalPath = await gitService.clone(url, targetPath);
    // Auto-save to recent projects
    await configService.saveConfig({ repoPath: finalPath });
    await configService.addRecentProject(finalPath);
    return { success: true, data: finalPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('git:init', async (_, targetPath) => {
  try {
    await gitService.init(targetPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('git:add', async (_, path) => {
  try {
    await gitService.addFile(path);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('git:diff', async (_, path) => {
  try {
    return { success: true, data: await gitService.getDiff(path) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// System
ipcMain.handle('system:showItemInFolder', async (_, path) => {
  shell.showItemInFolder(path);
  return { success: true };
});

ipcMain.handle('system:getLogPath', async () => {
    return { success: true, data: logPath };
});

// Project
ipcMain.handle('project:set', async (_, repoPath) => {
  try {
    await configService.saveConfig({ repoPath });
    await configService.addRecentProject(repoPath);
    await gitService.initRepo(); // Ensure initialized
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Crypto
ipcMain.handle('crypto:encrypt', async (_, content) => {
  try {
    return { success: true, data: await cryptoService.encryptContent(content) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('crypto:decrypt', async (_, content) => {
  try {
    return { success: true, data: await cryptoService.decryptContent(content) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

app.whenReady().then(async () => {
   log('App Ready Event Fired');
   
   try {
     log('Initializing ConfigService...');
     try {
        await configService.init();
        log('ConfigService Initialized');
     } catch (configError) {
        log(`ConfigService Init Failed: ${configError}`);
        // Do not throw, continue to create window
     }
     
     log('Initializing GitService...');
     try {
        await gitService.initRepo(); 
        log('GitService Initialized');
     } catch (gitError) {
        log(`GitService Init Failed: ${gitError}`);
        // Do not throw
     }
   } catch (e) {
     log(`Initialization critical failure: ${e}`);
   }
   
   createMenu()
   log('Creating Window...');
   try {
       createWindow()
       log('Window Created');
   } catch (winError) {
       log(`Create Window Failed: ${winError}`);
       dialog.showErrorBox('Fatal Error', `Failed to create window: ${winError}`);
   }
   
   // Register F12 to open DevTools
  globalShortcut.register('F12', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.toggleDevTools()
    }
  })

  // Register CommandOrControl+Shift+I to open DevTools (Chrome style)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.toggleDevTools()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Handle Media Protocol
  protocol.handle('media', (request) => {
    try {
      const parsedUrl = new URL(request.url)
      const filePath = parsedUrl.pathname
      
      // On Windows, pathname might start with /C:/... but pathToFileURL needs C:/... or handles it?
      // pathToFileURL('/C:/...') works on Windows? 
      // Actually pathToFileURL handles absolute paths well.
      // But if pathname comes from URL, it might be percent encoded?
      // new URL('...').pathname returns encoded path? No, it returns decoded usually? 
      // Wait, MDN says pathname is USVString.
      // node:url says: "The pathname property consists of the entire path section of the URL."
      // It is NOT decoded.
      
      const decodedPath = decodeURIComponent(filePath)
      
      // Fix for Windows: /C:/Users -> C:/Users
      if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decodedPath)) {
        // We probably don't need to strip it if we use pathToFileURL, but let's be safe
        // actually pathToFileURL('/C:/Users') -> file:///C:/Users which is valid
      }

      const fileUrl = pathToFileURL(decodedPath).toString()
      return net.fetch(fileUrl)
    } catch (error) {
      console.error('Media protocol error:', error)
      return new Response('Not Found', { status: 404 })
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})