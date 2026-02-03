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
  saveFileDirect: (path, content) => ipcRenderer.invoke('file:saveDirect', path, content),
  readHelpDoc: (fileName) => ipcRenderer.invoke('file:readHelpDoc', fileName),
  createFile: (parentPath, name) => ipcRenderer.invoke('file:create', parentPath, name),
  createDir: (parentPath, name) => ipcRenderer.invoke('file:createDir', parentPath, name),
  deleteItem: (path) => ipcRenderer.invoke('file:delete', path),
  renameItem: (oldPath, newName) => ipcRenderer.invoke('file:rename', oldPath, newName),
  moveItem: (sourcePath, targetParentPath) => ipcRenderer.invoke('file:move', sourcePath, targetParentPath),
  copyToAssets: (sourcePath, currentMdPath) => ipcRenderer.invoke('file:copyToAssets', sourcePath, currentMdPath),
  savePastedFile: (fileName, fileData, currentMdPath) => ipcRenderer.invoke('file:savePastedFile', fileName, fileData, currentMdPath),
  exportHtml: (content, defaultPath) => ipcRenderer.invoke('file:exportHtml', content, defaultPath),
  exportPdf: (htmlContent, defaultPath) => ipcRenderer.invoke('file:exportPdf', htmlContent, defaultPath),
  exportHtmlDirect: (content, outputPath) => ipcRenderer.invoke('file:exportHtmlDirect', content, outputPath),
  exportPdfDirect: (htmlContent, outputPath) => ipcRenderer.invoke('file:exportPdfDirect', htmlContent, outputPath),
  searchContent: (query) => ipcRenderer.invoke('file:searchContent', query),

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
  setLogPath: (newPath) => ipcRenderer.invoke('system:setLogPath', newPath),
  openLogDirectory: () => ipcRenderer.invoke('system:openLogDirectory'),
  getAllLogFiles: () => ipcRenderer.invoke('system:getAllLogFiles'),

  // Project
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  setProject: (repoPath) => ipcRenderer.invoke('project:set', repoPath),


  // Crypto
  encryptContent: (content) => ipcRenderer.invoke('crypto:encrypt', content),
  decryptContent: (content) => ipcRenderer.invoke('crypto:decrypt', content),

  // Schedule
  scheduleGetAll: () => ipcRenderer.invoke('schedule:getAll'),
  scheduleGetById: (id) => ipcRenderer.invoke('schedule:getById', id),
  scheduleAdd: (schedule) => ipcRenderer.invoke('schedule:add', schedule),
  scheduleUpdate: (id, updates) => ipcRenderer.invoke('schedule:update', id, updates),
  scheduleDelete: (id) => ipcRenderer.invoke('schedule:delete', id),
  scheduleToggleComplete: (id) => ipcRenderer.invoke('schedule:toggleComplete', id),
  scheduleGetToday: () => ipcRenderer.invoke('schedule:getToday'),
  scheduleGetUpcoming: () => ipcRenderer.invoke('schedule:getUpcoming'),
  scheduleGetOverdue: () => ipcRenderer.invoke('schedule:getOverdue'),

  // Listen for schedule notifications from main process
  onScheduleNotification: (callback) => ipcRenderer.on('schedule:notification', callback),
  removeScheduleNotificationListener: (callback) => ipcRenderer.removeListener('schedule:notification', callback),

  // Drink Reminder
  drinkReminderGetConfig: () => ipcRenderer.invoke('drinkReminder:getConfig'),
  drinkReminderUpdateConfig: (updates) => ipcRenderer.invoke('drinkReminder:updateConfig', updates),
  drinkReminderToggle: () => ipcRenderer.invoke('drinkReminder:toggle'),
  drinkReminderUpdateMessages: (messages) => ipcRenderer.invoke('drinkReminder:updateMessages', messages),
  drinkReminderResetMessages: () => ipcRenderer.invoke('drinkReminder:resetMessages'),

  // Password Manager
  getPasswordDataPath: () => ipcRenderer.invoke('password:getDataPath'),
  loadPasswordData: () => ipcRenderer.invoke('password:loadData'),
  savePasswordData: (data) => ipcRenderer.invoke('password:saveData', data),
  openPasswordDataLocation: () => ipcRenderer.invoke('password:openDataLocation'),
  hashPassword: (password) => ipcRenderer.invoke('password:hash', password),
  verifyPassword: (password, hash) => ipcRenderer.invoke('password:verify', password, hash),
  generateEncryptionSalt: () => ipcRenderer.invoke('password:generateSalt'),
  encryptPassword: (password, masterPassword, salt) => ipcRenderer.invoke('password:encrypt', password, masterPassword, salt),
  decryptPassword: (encryptedPassword, masterPassword, salt) => ipcRenderer.invoke('password:decrypt', encryptedPassword, masterPassword, salt),

  // Window Controls
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});

