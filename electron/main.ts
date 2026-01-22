import { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, net, globalShortcut } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { configService } from './services/configService'
import { fileService } from './services/fileService'
import { gitService } from './services/gitService'
import { cryptoService } from './services/cryptoService'
import { logService, log, logError, logWarn } from './services/logService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Register Privileged Schemes
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, standard: true, bypassCSP: true } }
])

// Initial logs
log(`App Path: ${app.getAppPath()}`);
log(`UserData Path: ${app.getPath('userData')}`);
log(`Log Path: ${logService.getLogPath()}`);

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

// Direct file write API for batch export (bypasses path validation)
ipcMain.handle('file:saveDirect', async (_, filePath, content) => {
  try {
    console.log('saveFileDirect called with path:', filePath);
    await fsPromises.writeFile(filePath, content, 'utf-8');
    console.log('saveFileDirect successfully wrote:', filePath);
    return { success: true, data: filePath };
  } catch (error) {
    console.error('saveFileDirect error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
})

// Read help documentation from project root (bypasses notebook path validation)
ipcMain.handle('file:readHelpDoc', async (_, fileName) => {
  try {
    const helpDocPath = path.join(__dirname, '..', '帮助文档', fileName);
    console.log('readHelpDoc called with path:', helpDocPath);
    const content = await fsPromises.readFile(helpDocPath, 'utf-8');
    console.log('readHelpDoc successfully read:', helpDocPath);
    return { success: true, data: content };
  } catch (error) {
    console.error('readHelpDoc error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
    const result = await fileService.renameItem(oldPath, newName)
    return { success: true, data: result.newPath }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:move', async (_, sourcePath, targetParentPath) => {
  try {
    const result = await fileService.moveItem(sourcePath, targetParentPath)
    return { success: true, data: result.newPath }
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

ipcMain.handle('file:searchContent', async (_, query) => {
  try {
    return { success: true, data: await fileService.searchContent(query) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

// Process images for HTML export - copy files to assets folder and update paths
// Returns: { html: processedHtml, images: Array<{original: string, copied: string}> }
const processHtmlForImages = async (
  htmlContent: string,
  exportDir: string,
  baseFileName: string,
  onProgress?: (current: number, total: number, fileName: string) => void
) => {
  // Find all img src="media://..." patterns
  // The pattern matches: src="media://local/Users/..." or src="media:///Users/..."
  const regex = /<img[^>]+src="media:\/\/(?:local|\/)?([^"]+)"/g;
  const matches = [...htmlContent.matchAll(regex)];

  if (matches.length === 0) {
    return { html: htmlContent, images: [] };
  }

  let processedHtml = htmlContent;
  const copiedImages: Array<{ original: string; copied: string }> = [];

  // Create assets directory next to the HTML file
  // Use a unique name to avoid conflicts: {basename}_assets
  const assetsDir = path.join(exportDir, `${baseFileName}_assets`);

  try {
    await fsPromises.mkdir(assetsDir, { recursive: true });
  } catch (e) {
    log(`Failed to create assets directory: ${e}`);
  }

  // Track processed images to avoid duplicates with same content
  const processedHashes = new Map<string, string>(); // hash -> filename

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const fullPathMatch = match[0]; // The entire src="media://..." part
    const mediaPath = match[1]; // The part after media://local or media:///

    try {
      // Decode path
      let decodedPath = decodeURIComponent(mediaPath);

      // Handle Windows path issues - remove leading slash if present for Windows absolute paths
      let localPath = decodedPath;
      if (process.platform === 'win32' && localPath.startsWith('/') && /^\/[a-zA-Z]:/.test(localPath)) {
        localPath = localPath.slice(1);
      }

      log(`Processing image: ${mediaPath} -> ${localPath}`);

      // Check if file exists
      try {
        await fsPromises.access(localPath);
      } catch {
        log(`Image file not found: ${localPath}`);
        continue;
      }

      // Read the file
      const fileBuffer = await fsPromises.readFile(localPath);
      const ext = path.extname(localPath) || '.png';

      // Generate a unique filename
      // Use counter + random to avoid conflicts
      const imageFileName = `image_${i + 1}${ext}`;
      const destPath = path.join(assetsDir, imageFileName);

      // Copy image to assets folder
      await fsPromises.copyFile(localPath, destPath);
      log(`Copied image from ${localPath} to ${destPath}`);

      // Update HTML to reference the copied image
      // Use relative path: basename_assets/image_xxx.png
      const relativePath = `${baseFileName}_assets/${imageFileName}`;
      processedHtml = processedHtml.replace(fullPathMatch, `src="${relativePath}"`);

      copiedImages.push({ original: localPath, copied: destPath });

      // Report progress
      if (onProgress) {
        onProgress(i + 1, matches.length, imageFileName);
      }

    } catch (e) {
      log(`Failed to copy image: ${mediaPath} ${e}`);
      // Keep original src if failed
    }
  }

  return { html: processedHtml, images: copiedImages };
};

// For PDF export, we still use base64 embedding since PDF needs everything in one file
const processHtmlContentForPdf = async (htmlContent: string) => {
  // Match media://local/... or media:///...
  const regex = /<img[^>]+src="media:\/\/(?:local|\/)?([^"]+)"/g;
  let processedHtml = htmlContent;
  const matches = [...htmlContent.matchAll(regex)];

  for (const match of matches) {
    const fullPathMatch = match[0];
    const mediaPath = match[1];

    try {
      const decodedPath = decodeURIComponent(mediaPath);

      let localPath = decodedPath;
      if (process.platform === 'win32' && localPath.startsWith('/') && /^\/[a-zA-Z]:/.test(localPath)) {
        localPath = localPath.slice(1);
      }

      const fileBuffer = await fsPromises.readFile(localPath);
      const base64 = fileBuffer.toString('base64');
      const ext = path.extname(localPath).slice(1);
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;

      const newSrc = `data:${mimeType};base64,${base64}`;
      processedHtml = processedHtml.replace(fullPathMatch, `src="${newSrc}"`);

    } catch (e) {
      log(`Failed to embed image for PDF: ${mediaPath} ${e}`);
    }
  }

  return processedHtml;
};

ipcMain.handle('file:exportHtml', async (event, content, defaultPath) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出 HTML',
      defaultPath,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    if (filePath) {
      // Get directory and base filename for assets folder
      const exportDir = path.dirname(filePath);
      const baseFileName = path.basename(filePath, path.extname(filePath));

      // Wrap content in a complete HTML document with proper styling
      const completeHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>导出的笔记</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        pre {
            background: #f6f8fa;
            padding: 16px;
            overflow: auto;
            border-radius: 6px;
        }
        code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 85%;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 8px 12px;
        }
        table th {
            background: #f6f8fa;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        a {
            color: #0969da;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .mermaid {
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

      // Process images - copy to assets folder
      const { html: finalContent } = await processHtmlForImages(completeHtml, exportDir, baseFileName);

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
      title: '导出 PDF',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (filePath) {
      // Wrap content in a complete HTML document with proper styling for PDF
      const completeHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>导出的笔记</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20mm;
            font-size: 11pt;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        pre {
            background: #f6f8fa;
            padding: 12px;
            overflow: auto;
            border-radius: 4px;
            font-size: 9pt;
        }
        code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 9pt;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
            font-size: 10pt;
        }
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 6px 10px;
        }
        table th {
            background: #f6f8fa;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 18px;
            margin-bottom: 12px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.4em; }
        h3 { font-size: 1.2em; }
        a {
            color: #0969da;
            text-decoration: none;
        }
        .mermaid {
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

      // Process images to base64 for PDF
      const finalContent = await processHtmlContentForPdf(completeHtml);

      // Get the icon path
      const iconPath = process.env.VITE_DEV_SERVER_URL
        ? path.join(__dirname, '../public/zhixia-logo.png')
        : path.join(__dirname, '../dist/zhixia-logo.png');

      const win = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: true },
        icon: iconPath,
        title: '知夏笔记'
      });
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalContent)}`);

      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          top: 0.4,
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

// Direct export APIs for batch export (no dialog)
ipcMain.handle('file:exportHtmlDirect', async (_, content, outputPath) => {
  try {
    console.log('exportHtmlDirect called with path:', outputPath);
    // Get directory and base filename for assets folder
    const exportDir = path.dirname(outputPath);
    const baseFileName = path.basename(outputPath, path.extname(outputPath));

    // Process images - copy to assets folder
    const { html: finalContent } = await processHtmlForImages(content, exportDir, baseFileName);

    await fsPromises.writeFile(outputPath, finalContent);
    console.log('exportHtmlDirect successfully wrote:', outputPath);
    return { success: true, data: outputPath };
  } catch (error) {
    console.error('exportHtmlDirect error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('file:exportPdfDirect', async (_, htmlContent, outputPath) => {
  try {
    console.log('exportPdfDirect called with path:', outputPath);
    // Wrap content in a complete HTML document with proper styling for PDF
    const completeHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>导出的笔记</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20mm;
            font-size: 11pt;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        pre {
            background: #f6f8fa;
            padding: 12px;
            overflow: auto;
            border-radius: 4px;
            font-size: 9pt;
        }
        code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 9pt;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
            font-size: 10pt;
        }
        table th,
        table td {
            border: 1px solid #ddd;
            padding: 6px 10px;
        }
        table th {
            background: #f6f8fa;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 18px;
            margin-bottom: 12px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.4em; }
        h3 { font-size: 1.2em; }
        a {
            color: #0969da;
            text-decoration: none;
        }
        .mermaid {
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    // Process images to base64 for PDF
    const finalContent = await processHtmlContentForPdf(completeHtml);

    // Get the icon path
    const iconPath = process.env.VITE_DEV_SERVER_URL
      ? path.join(__dirname, '../public/zhixia-logo.png')
      : path.join(__dirname, '../dist/zhixia-logo.png');

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true },
      icon: iconPath,
      title: '知夏笔记'
    });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalContent)}`);

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      }
    });
    await fsPromises.writeFile(outputPath, pdfData);
    console.log('exportPdfDirect successfully wrote:', outputPath);
    win.close();
    return { success: true, data: outputPath };
  } catch (error) {
    console.error('exportPdfDirect error:', error);
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
    return { success: true, data: logService.getLogPath() };
});

ipcMain.handle('system:setLogPath', async (_, newPath: string) => {
  try {
    const result = await logService.setLogPath(newPath);
    return { success: result, data: logService.getLogPath() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('system:openLogDirectory', async () => {
  try {
    await logService.openLogDirectory();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('system:getAllLogFiles', async () => {
  try {
    const files = await logService.getAllLogFiles();
    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
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