import { makeAutoObservable, runInAction } from 'mobx';
import type { ThemeMode, ThemeColor, AppConfig, ViewMode } from '../types';

export class UIStore {
  themeMode: ThemeMode = 'system';
  themeColor: ThemeColor = 'default';
  markdownTheme: string = 'default';
  viewMode: ViewMode = 'split';
  isSidebarOpen: boolean = true;
  isLoading: boolean = false;
  isProjectReady: boolean = false;

  constructor() {
    makeAutoObservable(this);
    this.initTheme();
  }

  async initTheme() {
    this.isLoading = true;
    try {
      const res = await window.electronAPI.getConfig();
      if (res.success && res.data) {
        runInAction(() => {
          this.themeMode = res.data!.themeMode;
          this.themeColor = res.data!.themeColor;
          this.markdownTheme = res.data!.markdownTheme || 'default';
          this.isProjectReady = !!res.data!.repoPath;
          this.applyTheme();
        });
      }
    } catch (error) {
      console.error('Failed to init theme:', error);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  setProjectReady(ready: boolean) {
    this.isProjectReady = ready;
  }

  async resetProject() {
    await this.saveConfig({ repoPath: '' });
    runInAction(() => {
      this.isProjectReady = false;
    });
  }


  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  async setThemeMode(mode: ThemeMode) {
    this.themeMode = mode;
    this.applyTheme();
    await this.saveConfig({ themeMode: mode });
  }

  async setThemeColor(color: string) {
    this.themeColor = color;
    this.applyTheme();
    await this.saveConfig({ themeColor: color });
  }

  async setMarkdownTheme(theme: string) {
    this.markdownTheme = theme;
    await this.saveConfig({ markdownTheme: theme });
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  private applyTheme() {
    const root = document.documentElement;
    
    // Mode
    if (this.themeMode === 'dark') {
      root.classList.add('dark');
    } else if (this.themeMode === 'light') {
      root.classList.remove('dark');
    } else {
      // System
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Color
    root.style.setProperty('--color-primary', this.themeColor);
    // Calculate a slightly darker/lighter variant if needed, or just use opacity
    // For now, we rely on opacity utils in Tailwind
  }

  private async saveConfig(config: Partial<AppConfig>) {
    await window.electronAPI.saveConfig(config);
  }
}
