// 核心数据结构定义

// 文件系统
export type FileType = 'file' | 'directory';

export interface FileNode {
  id: string;        // UUID
  name: string;      // 显示名称
  path: string;      // 绝对路径
  type: FileType;
  children?: FileNode[];
  level: number;     // 目录层级: 0(Root) -> 1(Category) -> 2(Note) -> 3(Invalid)

  // 仅在运行时使用的 UI 状态 (可选，MobX 中可能会单独维护)
  isExpanded?: boolean;
}

// 笔记元数据 (FrontMatter)
export interface NoteMeta {
  title: string;
  tags: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  [key: string]: unknown;
}

// 应用配置
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor = string;
export type ViewMode = 'editor' | 'preview' | 'split';

export interface AppConfig {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  markdownTheme?: string; // New field for Markdown theme
  repoPath: string;  // 本地仓库路径 (通常是 userHome/.zhixia-note)
  recentProjects: string[]; // 最近打开的项目路径列表
  remoteUrl?: string;
  sidebarWidth?: number; // 侧边栏宽度

  // 安全配置
  encryption: {
    enabled: boolean;
    // 注意: 密钥不在此处存储
  };
}

// Git 同步状态
export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'conflict' | 'error' | 'success';

export interface GitStatus {
  status: SyncStatus;
  lastSyncTime?: string;
  ahead: number;     // 本地领先提交数
  behind: number;    // 远程领先提交数
  modified: number;  // 本地修改文件数
  conflictedFiles: string[];
  errorMessage?: string;
  // File-level status map
  files: Record<string, FileGitStatus>;
}

export interface FileGitStatus {
  path: string;
  index: string;       // Staged status (e.g., 'A', 'M')
  working_dir: string; // Working dir status (e.g., 'M', '?')
}

// IPC 通信泛型接口
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 日程相关类型
export interface ScheduleReminder {
  type: 'minutes' | 'hours' | 'days';
  value: number;
  notified?: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  reminders: ScheduleReminder[];
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// 饮水提醒相关类型
export interface DrinkReminderConfig {
  enabled: boolean;
  startHour: number;
  endHour: number;
  intervalMinutes: number;
  messages: string[];
  nextReminderTime?: string | null;
}

// 密码管理相关类型
export interface PasswordEntry {
  id: string;
  title: string;
  username?: string;
  password: string;
  email?: string;
  website?: string;
  notes?: string;
  encrypted: boolean; // Whether password is encrypted
  createdAt: string;
  updatedAt: string;
}

export interface PasswordSettings {
  masterPasswordHash?: string; // Hashed master password
  encryptionSalt?: string; // Unique salt for encryption (generated per user)
  encryptionEnabled: boolean;
  autoLockMinutes: number;
}

export interface PasswordData {
  passwords: PasswordEntry[];
  settings: PasswordSettings;
}

export interface IpcApi {
  // System
  showItemInFolder: (path: string) => Promise<IpcResponse<void>>;
  getLogPath: () => Promise<IpcResponse<string>>;

  // Project
  setProject: (repoPath: string) => Promise<IpcResponse<void>>;
}
