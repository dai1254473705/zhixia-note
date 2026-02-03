import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';

// Tab interface
export interface OpenTab {
  file: FileNode;
  content: string;
  originalContent: string;
  isModified: boolean;
}

export class TabStore {
  openTabs: OpenTab[] = [];
  activeTabId: string | null = null;
  maxTabs: number = 20; // Increased from 10 to 20 for better usability

  // Store tab contents separately for persistence
  private tabContents: Map<string, { content: string; originalContent: string }> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  // Check if we can open more tabs
  canOpenTab(): boolean {
    return this.openTabs.length < this.maxTabs;
  }

  // Find existing tab by file path
  findTabByPath(path: string): OpenTab | undefined {
    return this.openTabs.find(tab => tab.file.path === path);
  }

  // Find existing tab by tab id
  findTabById(tabId: string): OpenTab | undefined {
    return this.openTabs.find(tab => tab.file.id === tabId);
  }

  // Add a new tab
  addTab(tab: OpenTab) {
    if (!this.canOpenTab()) {
      throw new Error(`最多只能打开 ${this.maxTabs} 个标签页`);
    }
    runInAction(() => {
      this.openTabs.push(tab);
      this.tabContents.set(tab.file.id, {
        content: tab.content,
        originalContent: tab.originalContent
      });
      this.activeTabId = tab.file.id;
    });
  }

  // Update tab content
  updateTabContent(tabId: string, content: string, originalContent: string) {
    const tab = this.findTabById(tabId);
    if (tab) {
      runInAction(() => {
        tab.content = content;
        tab.originalContent = originalContent;
        tab.isModified = content !== originalContent;
        this.tabContents.set(tabId, { content, originalContent });
      });
    }
  }

  // Switch to a different tab
  switchTab(tabId: string) {
    const tab = this.findTabById(tabId);
    if (!tab) return;

    runInAction(() => {
      this.activeTabId = tabId;
    });
  }

  // Close a tab
  closeTab(tabId: string): OpenTab | null {
    const tabIndex = this.openTabs.findIndex(t => t.file.id === tabId);
    if (tabIndex === -1) return null;

    const tab = this.openTabs[tabIndex];

    runInAction(() => {
      // Remove tab
      this.openTabs.splice(tabIndex, 1);
      this.tabContents.delete(tabId);

      // If closing the active tab, switch to another
      if (this.activeTabId === tabId) {
        if (this.openTabs.length > 0) {
          // Switch to the right tab, or the left tab if closing the last one
          const newIndex = Math.min(tabIndex, this.openTabs.length - 1);
          const newTab = this.openTabs[newIndex];
          this.activeTabId = newTab.file.id;
        } else {
          // No more tabs
          this.activeTabId = null;
        }
      }
    });

    return tab;
  }

  // Get the active tab
  getActiveTab(): OpenTab | undefined {
    return this.findTabById(this.activeTabId || '');
  }

  // Get all tabs (sorted by opened order)
  getAllTabs(): OpenTab[] {
    return this.openTabs;
  }

  // Clear all tabs
  clearAllTabs() {
    runInAction(() => {
      this.openTabs = [];
      this.activeTabId = null;
      this.tabContents.clear();
    });
  }

  // Check if there are any tabs
  hasTabs(): boolean {
    return this.openTabs.length > 0;
  }

  // Get tab content from storage
  getTabContent(tabId: string): { content: string; originalContent: string } | undefined {
    return this.tabContents.get(tabId);
  }
}
