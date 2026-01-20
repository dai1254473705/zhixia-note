const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // File
  getFileTree: () => ipcRenderer.invoke('file:getTree'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (path, content) => ipcRenderer.invoke('file:save', path, content),
  createFile: (parentPath, name) => ipcRenderer.invoke('file:create', parentPath, name),
  createDir: (parentPath, name) => ipcRenderer.invoke('file:createDir', parentPath, name),
  deleteItem: (path) => ipcRenderer.invoke('file:delete', path),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('file:rename', oldPath, newName),
  copyToAssets: (sourcePath, currentMdPath) => ipcRenderer.invoke('file:copyToAssets', sourcePath, currentMdPath),
  exportHtml: (content, defaultPath) => ipcRenderer.invoke('file:exportHtml', content, defaultPath),
  exportPdf: (htmlContent, defaultPath) => ipcRenderer.invoke('file:exportPdf', htmlContent, defaultPath),

  // Git
  getGitStatus: () => ipcRenderer.invoke('git:status'),
  commitGit: (message) => ipcRenderer.invoke('git:commit', message),
  syncGit: () => ipcRenderer.invoke('git:sync'),
  cloneGit: (url, targetPath) => ipcRenderer.invoke('git:clone', url, targetPath),
  initGit: (targetPath) => ipcRenderer.invoke('git:init', targetPath),
  addGit: (path) => ipcRenderer.invoke('git:add', path),
  getGitDiff: (path) => ipcRenderer.invoke('git:diff', path),

  // System
  showItemInFolder: (path) => ipcRenderer.invoke('system:showItemInFolder', path),
  getLogPath: () => ipcRenderer.invoke('system:getLogPath'),

  // Project
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  setProject: (repoPath) => ipcRenderer.invoke('project:set', repoPath),


  // Crypto
  encryptContent: (content) => ipcRenderer.invoke('crypto:encrypt', content),
  decryptContent: (content) => ipcRenderer.invoke('crypto:decrypt', content),

  // Window Controls
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
