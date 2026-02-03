import { AppConfig, FileNode, GitStatus, IpcResponse, ScheduleItem, DrinkReminderConfig, PasswordEntry, PasswordSettings, PasswordData } from './index';

declare global {
  interface Window {
    electronAPI: {
      // Config
      getConfig: () => Promise<IpcResponse<AppConfig>>;
      saveConfig: (config: Partial<AppConfig>) => Promise<IpcResponse<AppConfig>>;

      // File
      getFileTree: () => Promise<IpcResponse<FileNode[]>>;
      readFile: (path: string) => Promise<IpcResponse<string>>;
      saveFile: (path: string, content: string) => Promise<IpcResponse<void>>;
      saveFileDirect: (path: string, content: string) => Promise<IpcResponse<string>>;
      readHelpDoc: (fileName: string) => Promise<IpcResponse<string>>;
      createFile: (parentPath: string, name: string) => Promise<IpcResponse<FileNode>>;
      createDir: (parentPath: string, name: string) => Promise<IpcResponse<FileNode>>;
      deleteItem: (path: string) => Promise<IpcResponse<void>>;
      renameItem: (oldPath: string, newName: string) => Promise<IpcResponse<string>>;
      moveItem: (sourcePath: string, targetParentPath: string) => Promise<IpcResponse<string>>;
      copyToAssets: (sourcePath: string, currentMdPath: string) => Promise<IpcResponse<string>>;
      savePastedFile: (fileName: string, fileData: Uint8Array, currentMdPath: string) => Promise<IpcResponse<string>>;
      exportHtml: (content: string, defaultPath?: string) => Promise<IpcResponse<string>>;
      exportPdf: (htmlContent: string, defaultPath?: string) => Promise<IpcResponse<string>>;
      exportHtmlDirect: (content: string, outputPath: string) => Promise<IpcResponse<string>>;
      exportPdfDirect: (htmlContent: string, outputPath: string) => Promise<IpcResponse<string>>;
      searchContent: (query: string) => Promise<IpcResponse<Array<{ path: string; name: string; matches: string[] }>>>;

      // Git
      getGitStatus: () => Promise<IpcResponse<GitStatus>>;
      commitGit: (message: string) => Promise<IpcResponse<GitStatus>>;
      syncGit: () => Promise<IpcResponse<GitStatus>>;
      cloneGit: (url: string, targetPath: string) => Promise<IpcResponse<string>>;
      initGit: (targetPath: string) => Promise<IpcResponse<void>>;
      addGit: (path: string) => Promise<IpcResponse<void>>;
      getGitDiff: (path: string) => Promise<IpcResponse<string>>;

      // System
      showItemInFolder: (path: string) => Promise<IpcResponse<void>>;
      getLogPath: () => Promise<IpcResponse<string>>;
      setLogPath: (newPath: string) => Promise<IpcResponse<string>>;
      openLogDirectory: () => Promise<IpcResponse<void>>;
      getAllLogFiles: () => Promise<IpcResponse<string[]>>;

      // Project
      openDirectory: () => Promise<IpcResponse<{ canceled: boolean; filePaths: string[] }>>;
      openFile: (options?: { filters: { name: string; extensions: string[] }[] }) => Promise<IpcResponse<{ canceled: boolean; filePaths: string[] }>>;
      setProject: (repoPath: string) => Promise<IpcResponse<void>>;

      // Crypto
      encryptContent: (content: string) => Promise<IpcResponse<string>>;
      decryptContent: (content: string) => Promise<IpcResponse<string>>;

      // Schedule
      scheduleGetAll: () => Promise<IpcResponse<ScheduleItem[]>>;
      scheduleGetById: (id: string) => Promise<IpcResponse<ScheduleItem>>;
      scheduleAdd: (schedule: Omit<ScheduleItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IpcResponse<ScheduleItem>>;
      scheduleUpdate: (id: string, updates: Partial<ScheduleItem>) => Promise<IpcResponse<ScheduleItem>>;
      scheduleDelete: (id: string) => Promise<IpcResponse<void>>;
      scheduleToggleComplete: (id: string) => Promise<IpcResponse<ScheduleItem>>;
      scheduleGetToday: () => Promise<IpcResponse<ScheduleItem[]>>;
      scheduleGetUpcoming: () => Promise<IpcResponse<ScheduleItem[]>>;
      scheduleGetOverdue: () => Promise<IpcResponse<ScheduleItem[]>>;
      onScheduleNotification: (callback: () => void) => void;
      removeScheduleNotificationListener: (callback: () => void) => void;

      // Drink Reminder
      drinkReminderGetConfig: () => Promise<IpcResponse<DrinkReminderConfig>>;
      drinkReminderUpdateConfig: (updates: Partial<DrinkReminderConfig>) => Promise<IpcResponse<DrinkReminderConfig>>;
      drinkReminderToggle: () => Promise<IpcResponse<DrinkReminderConfig>>;
      drinkReminderUpdateMessages: (messages: string[]) => Promise<IpcResponse<string[]>>;
      drinkReminderResetMessages: () => Promise<IpcResponse<string[]>>;

      // Password Manager
      getPasswordDataPath: () => Promise<IpcResponse<string>>;
      loadPasswordData: () => Promise<IpcResponse<PasswordData>>;
      savePasswordData: (data: PasswordData) => Promise<IpcResponse<void>>;
      openPasswordDataLocation: () => Promise<IpcResponse<void>>;
      hashPassword: (password: string) => Promise<IpcResponse<string>>;
      verifyPassword: (password: string, hash: string) => Promise<IpcResponse<boolean>>;
      generateEncryptionSalt: () => Promise<IpcResponse<string>>;
      encryptPassword: (password: string, masterPassword: string, salt?: string) => Promise<IpcResponse<string>>;
      decryptPassword: (encryptedPassword: string, masterPassword: string, salt?: string) => Promise<IpcResponse<string>>;

      // Window
      maximizeWindow: () => void;
      minimizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

export {};
