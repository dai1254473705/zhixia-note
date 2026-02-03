import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';

export interface TrashItem {
  id: string;
  originalPath: string;
  trashPath: string;
  name: string;
  type: 'file' | 'directory';
  deletedAt: number;
  size?: number;
  content?: string; // For files, store content for restore
  children?: TrashItem[]; // For directories
}

export class TrashStore {
  trashItems: Map<string, TrashItem> = new Map();
  isLoading: boolean = false;
  autoCleanupDays: number = 30; // Auto-delete after 30 days

  private readonly STORAGE_KEY = 'zhixia-trash';
  private readonly TRASH_DIR_NAME = '.trash';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as TrashItem[];
        runInAction(() => {
          this.trashItems = new Map(items.map(item => [item.id, item]));
        });
      }
    } catch (error) {
      console.error('Failed to load trash:', error);
    }
  }

  private saveToStorage() {
    try {
      const items = Array.from(this.trashItems.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save trash:', error);
    }
  }

  // Get trash directory path for a given root path
  getTrashDir(rootPath: string): string {
    return `${rootPath}/${this.TRASH_DIR_NAME}`;
  }

  // Add item to trash
  async moveToTrash(
    rootPath: string,
    node: FileNode,
    readFile?: (path: string) => Promise<string>,
    children?: FileNode[]
  ): Promise<void> {
    const trashDir = this.getTrashDir(rootPath);
    const itemId = `${node.path}_${Date.now()}`;
    const trashFileName = `${node.name}_${Date.now()}`;
    const trashPath = `${trashDir}/${trashFileName}`;

    // Read content if it's a file and readFile is provided
    let content: string | undefined;
    if (node.type === 'file' && readFile) {
      try {
        content = await readFile(node.path);
      } catch (error) {
        // Silently ignore read errors during deletion - file might be locked or inaccessible
        // This prevents scary errors in the console when deleting files
        console.warn('Could not read file content for trash backup:', node.path);
      }
    }

    // Recursively add children for directories
    let trashChildren: TrashItem[] | undefined;
    if (node.type === 'directory' && children) {
      trashChildren = [];
      for (const child of children) {
        const childItem: TrashItem = {
          id: `${child.path}_${Date.now()}`,
          originalPath: child.path,
          trashPath: `${trashPath}/${child.name}`,
          name: child.name,
          type: child.type,
          deletedAt: Date.now(),
        };
        trashChildren.push(childItem);
      }
    }

    const trashItem: TrashItem = {
      id: itemId,
      originalPath: node.path,
      trashPath,
      name: node.name,
      type: node.type,
      deletedAt: Date.now(),
      content,
      children: trashChildren,
    };

    runInAction(() => {
      this.trashItems.set(itemId, trashItem);
    });

    this.saveToStorage();
  }

  // Restore item from trash
  async restoreFromTrash(itemId: string, writeFile?: (path: string, content: string) => Promise<boolean>): Promise<boolean> {
    const trashItem = this.trashItems.get(itemId);
    if (!trashItem) return false;

    try {
      // Restore file content if writeFile is provided
      if (trashItem.type === 'file' && trashItem.content && writeFile) {
        await writeFile(trashItem.originalPath, trashItem.content);
      }

      // Remove from trash
      runInAction(() => {
        this.trashItems.delete(itemId);
      });

      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to restore item:', error);
      return false;
    }
  }

  // Permanently delete item from trash
  permanentlyDelete(itemId: string): boolean {
    const trashItem = this.trashItems.get(itemId);
    if (!trashItem) return false;

    runInAction(() => {
      this.trashItems.delete(itemId);
    });

    this.saveToStorage();
    return true;
  }

  // Get all trash items sorted by deletion date
  getAllTrashItems(): TrashItem[] {
    return Array.from(this.trashItems.values()).sort((a, b) => b.deletedAt - a.deletedAt);
  }

  // Get trash items grouped by date
  getTrashItemsByDate(): Map<string, TrashItem[]> {
    const grouped = new Map<string, TrashItem[]>();

    for (const item of this.trashItems.values()) {
      const date = new Date(item.deletedAt).toLocaleDateString('zh-CN');
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(item);
    }

    return grouped;
  }

  // Empty trash (delete all items)
  emptyTrash(): void {
    runInAction(() => {
      this.trashItems.clear();
    });
    this.saveToStorage();
  }

  // Get trash count
  get trashCount(): number {
    return this.trashItems.size;
  }

  // Check if item is in trash
  isInTrash(originalPath: string): boolean {
    for (const item of this.trashItems.values()) {
      if (item.originalPath === originalPath) return true;
    }
    return false;
  }

  // Clean up old items (older than autoCleanupDays)
  cleanupOldItems(): void {
    const now = Date.now();
    const maxAge = this.autoCleanupDays * 24 * 60 * 60 * 1000;

    for (const [id, item] of this.trashItems) {
      if (now - item.deletedAt > maxAge) {
        this.permanentlyDelete(id);
      }
    }
  }

  // Get size of trash in bytes
  getTrashSize(): number {
    let size = 0;
    for (const item of this.trashItems.values()) {
      size += item.size || 0;
      if (item.content) {
        size += item.content.length * 2; // Approximate UTF-16 size
      }
    }
    return size;
  }

  // Format size for display
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get formatted trash size
  get formattedTrashSize(): string {
    return this.formatSize(this.getTrashSize());
  }
}
