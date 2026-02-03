import { makeAutoObservable, runInAction } from 'mobx';

export interface ShortcutConfig {
  id: string;
  name: string;
  description: string;
  defaultKey: string;
  customKey?: string;
  modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[];
  category: 'editor' | 'file' | 'view' | 'navigation';
}

export type ShortcutAction = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  // Editor shortcuts
  { id: 'save', name: '保存', description: '保存当前文件', defaultKey: 's', modifiers: ['meta'], category: 'editor' },
  { id: 'format', name: '格式化', description: '格式化 Markdown', defaultKey: 's', modifiers: ['shift', 'meta'], category: 'editor' },
  { id: 'bold', name: '粗体', description: '插入粗体文本', defaultKey: 'b', modifiers: ['meta'], category: 'editor' },
  { id: 'italic', name: '斜体', description: '插入斜体文本', defaultKey: 'i', modifiers: ['meta'], category: 'editor' },
  { id: 'strike', name: '删除线', description: '插入删除线文本', defaultKey: 's', modifiers: ['shift', 'alt'], category: 'editor' },
  { id: 'code', name: '代码', description: '插入行内代码', defaultKey: 'e', modifiers: ['meta'], category: 'editor' },
  { id: 'link', name: '链接', description: '插入链接', defaultKey: 'k', modifiers: ['meta'], category: 'editor' },

  // File operations
  { id: 'newFile', name: '新建文件', description: '创建新笔记', defaultKey: 'n', modifiers: ['meta'], category: 'file' },
  { id: 'search', name: '搜索', description: '打开搜索', defaultKey: 'p', modifiers: ['meta', 'shift'], category: 'file' },

  // View shortcuts
  { id: 'toggleSidebar', name: '切换侧边栏', description: '显示/隐藏侧边栏', defaultKey: 'b', modifiers: ['meta'], category: 'view' },
  { id: 'togglePreview', name: '切换预览', description: '切换预览模式', defaultKey: 'd', modifiers: ['meta'], category: 'view' },
  { id: 'splitView', name: '分屏视图', description: '编辑器/预览分屏', defaultKey: 'd', modifiers: ['shift', 'meta'], category: 'view' },

  // Navigation
  { id: 'quickOpen', name: '快速打开', description: '快速打开文件', defaultKey: 'p', modifiers: ['meta'], category: 'navigation' },
];

export class KeyboardShortcutStore {
  shortcuts: ShortcutConfig[] = [];
  isRecording: boolean = false;
  recordingShortcutId: string | null = null;

  private readonly STORAGE_KEY = 'zhixia-keyboard-shortcuts';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const customKeys = JSON.parse(stored) as Record<string, string>;
        runInAction(() => {
          this.shortcuts = DEFAULT_SHORTCUTS.map(s => ({
            ...s,
            customKey: customKeys[s.id]
          }));
        });
      } else {
        runInAction(() => {
          this.shortcuts = [...DEFAULT_SHORTCUTS];
        });
      }
    } catch (error) {
      console.error('Failed to load keyboard shortcuts:', error);
      runInAction(() => {
        this.shortcuts = [...DEFAULT_SHORTCUTS];
      });
    }
  }

  private saveToStorage() {
    try {
      const customKeys: Record<string, string> = {};
      this.shortcuts.forEach(s => {
        if (s.customKey) {
          customKeys[s.id] = s.customKey;
        }
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customKeys));
    } catch (error) {
      console.error('Failed to save keyboard shortcuts:', error);
    }
  }

  getShortcut(id: string): ShortcutConfig | undefined {
    return this.shortcuts.find(s => s.id === id);
  }

  getActiveShortcut(id: string): string {
    const shortcut = this.getShortcut(id);
    if (!shortcut) return '';
    const key = shortcut.customKey || shortcut.defaultKey;
    return this.formatShortcutDisplay(shortcut.modifiers, key);
  }

  getShortcutAction(id: string): ShortcutAction | null {
    const shortcut = this.getShortcut(id);
    if (!shortcut) return null;
    const key = shortcut.customKey || shortcut.defaultKey;
    return {
      key,
      ctrlKey: shortcut.modifiers.includes('ctrl'),
      metaKey: shortcut.modifiers.includes('meta'),
      shiftKey: shortcut.modifiers.includes('shift'),
      altKey: shortcut.modifiers.includes('alt'),
    };
  }

  formatShortcutDisplay(modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[], key: string): string {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierMap: Record<string, string> = {
      meta: isMac ? '⌘' : 'Ctrl',
      ctrl: isMac ? '⌃' : 'Ctrl',
      shift: isMac ? '⇧' : 'Shift',
      alt: isMac ? '⌥' : 'Alt',
    };
    return [...modifiers, key.toUpperCase()]
      .map(m => modifierMap[m] || m)
      .join(isMac ? '' : '+');
  }

  startRecording(id: string) {
    this.isRecording = true;
    this.recordingShortcutId = id;
  }

  stopRecording() {
    this.isRecording = false;
    this.recordingShortcutId = null;
  }

  setShortcut(id: string, key: string, modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[]) {
    runInAction(() => {
      const shortcut = this.shortcuts.find(s => s.id === id);
      if (shortcut) {
        shortcut.customKey = key;
        shortcut.modifiers = modifiers;
      }
    });
    this.saveToStorage();
  }

  resetShortcut(id: string) {
    runInAction(() => {
      const shortcut = this.shortcuts.find(s => s.id === id);
      if (shortcut) {
        shortcut.customKey = undefined;
        const defaultShortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
        if (defaultShortcut) {
          shortcut.modifiers = [...defaultShortcut.modifiers];
        }
      }
    });
    this.saveToStorage();
  }

  resetAll() {
    runInAction(() => {
      this.shortcuts = [...DEFAULT_SHORTCUTS];
    });
    this.saveToStorage();
  }

  getShortcutsByCategory(category: ShortcutConfig['category']): ShortcutConfig[] {
    return this.shortcuts.filter(s => s.category === category);
  }

  // Check if a keyboard event matches a shortcut
  matchesShortcut(id: string, event: KeyboardEvent): boolean {
    const action = this.getShortcutAction(id);
    if (!action) return false;

    return (
      event.key.toLowerCase() === action.key.toLowerCase() &&
      !!event.ctrlKey === !!action.ctrlKey &&
      !!event.metaKey === !!action.metaKey &&
      !!event.shiftKey === !!action.shiftKey &&
      !!event.altKey === !!action.altKey
    );
  }
}
