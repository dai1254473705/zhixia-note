import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { app } from 'electron';

class LogService {
  private logPath: string;
  private logQueue: string[] = [];
  private isWriting: boolean = false;
  private currentSessionLogPath: string = '';
  private maxLogFileSize = 10 * 1024 * 1024; // 10MB per log file
  private maxLogFiles = 5; // Keep max 5 log files

  constructor() {
    // Get log path from config or use default
    const defaultLogDir = path.join(app.getPath('userData'), 'logs');
    this.logPath = path.join(defaultLogDir, 'zhixia.log');
    this.ensureLogDirectory();
    this.startNewSession();
    this.processQueue();
  }

  private ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create log directory:', e);
    }
  }

  private startNewSession() {
    try {
      // Check if current log file is too large
      if (fs.existsSync(this.logPath)) {
        const stats = fs.statSync(this.logPath);
        if (stats.size > this.maxLogFileSize) {
          this.rotateLogs();
        }
      }

      // Create session marker
      const sessionMarker = `\n\n========== Session Start: ${new Date().toISOString()} ==========\n`;
      this.writeSync(sessionMarker);
      this.currentSessionLogPath = this.logPath;
    } catch (e) {
      console.error('Failed to start new log session:', e);
    }
  }

  private rotateLogs() {
    try {
      const logDir = path.dirname(this.logPath);
      const baseName = path.basename(this.logPath, path.extname(this.logPath));
      const ext = path.extname(this.logPath);

      // Remove oldest log if we have too many
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldLog = path.join(logDir, `${baseName}.${i}${ext}`);
        if (fs.existsSync(oldLog)) {
          fs.unlinkSync(oldLog);
        }
      }

      // Rotate existing logs: .4 -> .5, .3 -> .4, etc.
      for (let i = this.maxLogFiles - 2; i >= 1; i--) {
        const oldLog = path.join(logDir, `${baseName}.${i}${ext}`);
        const newLog = path.join(logDir, `${baseName}.${i + 1}${ext}`);
        if (fs.existsSync(oldLog)) {
          fs.renameSync(oldLog, newLog);
        }
      }

      // Move current log to .1
      if (fs.existsSync(this.logPath)) {
        const rotatedLog = path.join(logDir, `${baseName}.1${ext}`);
        fs.renameSync(this.logPath, rotatedLog);
      }
    } catch (e) {
      console.error('Failed to rotate logs:', e);
    }
  }

  private writeSync(msg: string) {
    try {
      fs.appendFileSync(this.logPath, msg);
    } catch {
      // Ignore write errors
    }
  }

  private async processQueue() {
    if (this.isWriting || this.logQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    while (this.logQueue.length > 0) {
      const msg = this.logQueue.shift();
      if (msg) {
        try {
          await fsPromises.appendFile(this.logPath, msg);
        } catch {
          // Ignore write errors
        }
      }
    }

    this.isWriting = false;
  }

  log(msg: string, level: 'log' | 'error' | 'warn' = 'log') {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;

    // Always console log
    if (level === 'error') {
      console.error(msg);
    } else if (level === 'warn') {
      console.warn(msg);
    } else {
      console.log(msg);
    }

    // Add to queue for async file writing
    this.logQueue.push(logMsg);

    // Process queue in next tick
    setImmediate(() => this.processQueue());
  }

  error(msg: string) {
    this.log(msg, 'error');
  }

  warn(msg: string) {
    this.log(msg, 'warn');
  }

  // Get current log path
  getLogPath(): string {
    return this.logPath;
  }

  // Get all log files in the log directory
  async getAllLogFiles(): Promise<string[]> {
    try {
      const logDir = path.dirname(this.logPath);
      const baseName = path.basename(this.logPath, path.extname(this.logPath));
      const ext = path.extname(this.logPath);

      const files = await fsPromises.readdir(logDir);
      return files
        .filter(f => f.startsWith(baseName))
        .sort((a, b) => a.localeCompare(b))
        .map(f => path.join(logDir, f));
    } catch {
      return [this.logPath];
    }
  }

  // Set custom log path (restart required)
  async setLogPath(newPath: string): Promise<boolean> {
    try {
      const newDir = path.dirname(newPath);
      await fsPromises.mkdir(newDir, { recursive: true });

      // Copy current log to new location
      if (fs.existsSync(this.logPath)) {
        await fsPromises.copyFile(this.logPath, newPath);
      }

      this.logPath = newPath;
      this.startNewSession();
      return true;
    } catch (e) {
      console.error('Failed to set log path:', e);
      return false;
    }
  }

  // Open log directory in file manager
  async openLogDirectory() {
    const { shell } = await import('electron');
    const logDir = path.dirname(this.logPath);
    shell.openPath(logDir);
  }
}

// Singleton instance
export const logService = new LogService();

// Convenience functions
export const log = (msg: string) => logService.log(msg);
export const logError = (msg: string) => logService.error(msg);
export const logWarn = (msg: string) => logService.warn(msg);
