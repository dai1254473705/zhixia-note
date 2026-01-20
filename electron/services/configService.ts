import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { AppConfig } from '../../src/types';

const CONFIG_DIR_NAME = '.github-notebook';
const CONFIG_FILE_NAME = 'config.json';
const SECRET_FILE_NAME = '.secret';
const GITIGNORE_FILE_NAME = '.gitignore';

const DEFAULT_CONFIG: AppConfig = {
  themeMode: 'system',
  themeColor: 'default',
  markdownTheme: 'default',
  repoPath: '', // Will be initialized dynamically
  recentProjects: [],
  encryption: {
    enabled: false
  }
};

export class ConfigService {
  private rootDir: string;
  private configPath: string;
  private secretPath: string;
  private configCache: AppConfig | null = null;

  constructor() {
    if (app.isPackaged) {
      this.rootDir = path.join(app.getPath('home'), CONFIG_DIR_NAME);
    } else {
      // In development (and sandbox), use project directory to avoid permission issues
      this.rootDir = path.join(process.cwd(), CONFIG_DIR_NAME);
    }
    this.configPath = path.join(this.rootDir, CONFIG_FILE_NAME);
    this.secretPath = path.join(this.rootDir, SECRET_FILE_NAME);
  }

  /**
   * Initialize the configuration directory and files.
   * This should be called on app startup.
   */
  async init(): Promise<void> {
    try {
      // 1. Ensure root dir exists
      console.log('Ensure root dir:', this.rootDir);
      await fs.ensureDir(this.rootDir);

      // 2. Ensure .gitignore exists and ignores sensitive files
      // This is crucial for Security Rule #2
      const gitignorePath = path.join(this.rootDir, GITIGNORE_FILE_NAME);
      const gitignoreContent = `${CONFIG_FILE_NAME}\n${SECRET_FILE_NAME}\n`;
      
      if (!await fs.pathExists(gitignorePath)) {
          await fs.writeFile(gitignorePath, gitignoreContent);
      } else {
          const currentContent = await fs.readFile(gitignorePath, 'utf-8');
          if (!currentContent.includes(CONFIG_FILE_NAME) || !currentContent.includes(SECRET_FILE_NAME)) {
              await fs.appendFile(gitignorePath, `\n${CONFIG_FILE_NAME}\n${SECRET_FILE_NAME}\n`);
          }
      }

      // 3. Ensure config.json exists
      console.log('Check config path:', this.configPath);
      if (!await fs.pathExists(this.configPath)) {
        // Initial config with empty repoPath, waiting for user selection
        const initialConfig: AppConfig = { 
          ...DEFAULT_CONFIG, 
          repoPath: '' 
        };
        await fs.writeJson(this.configPath, initialConfig, { spaces: 2 });
        this.configCache = initialConfig;
      } else {
        const currentConfig = await fs.readJson(this.configPath);
        // Merge with default config to ensure all fields exist
        this.configCache = { ...DEFAULT_CONFIG, ...currentConfig };
        
        // If the file on disk was missing fields, update it
        if (JSON.stringify(currentConfig) !== JSON.stringify(this.configCache)) {
             await fs.writeJson(this.configPath, this.configCache, { spaces: 2 });
        }
      }
    } catch (error) {
      console.error('Failed to initialize ConfigService:', error);
      throw error;
    }
  }

  async getConfig(): Promise<AppConfig> {
    if (!this.configCache) {
      await this.init();
    }
    return this.configCache!;
  }

  async saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    const current = await this.getConfig();
    const newConfig = { ...current, ...config };
    await fs.writeJson(this.configPath, newConfig, { spaces: 2 });
    this.configCache = newConfig;
    return newConfig;
  }

  async addRecentProject(projectPath: string): Promise<AppConfig> {
    const config = await this.getConfig();
    let recent = config.recentProjects || [];
    
    // Remove if exists (to move to top)
    recent = recent.filter(p => p !== projectPath);
    
    // Add to top
    recent.unshift(projectPath);
    
    // Limit to 10
    if (recent.length > 10) {
      recent = recent.slice(0, 10);
    }
    
    return this.saveConfig({ recentProjects: recent });
  }

  async getSecret(): Promise<{ key: string; iv: string } | null> {
    if (!await fs.pathExists(this.secretPath)) return null;
    return fs.readJson(this.secretPath);
  }

  async saveSecret(key: string, iv: string): Promise<void> {
    // Ensure strict permissions for secret file if possible (0o600)
    await fs.writeJson(this.secretPath, { key, iv }, { spaces: 2, mode: 0o600 });
  }

  getRootDir(): string {
    return this.rootDir;
  }
}

export const configService = new ConfigService();
