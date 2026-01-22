import { AppConfig, FileNode, GitStatus, IpcResponse } from './index';

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

      // Window
      maximizeWindow: () => void;
      minimizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

export {};
