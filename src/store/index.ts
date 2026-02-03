import { createContext, useContext } from 'react';
import { FileStore } from './FileStore';
import { UIStore } from './UIStore';
import { GitStore } from './GitStore';
import { ToastStore } from './ToastStore';
import { ScheduleStore } from './ScheduleStore';
import { DrinkReminderStore } from './DrinkReminderStore';
import { PasswordStore } from './PasswordStore';
import { BacklinkStore } from './BacklinkStore';
import { KeyboardShortcutStore } from './KeyboardShortcutStore';
import { TagStore } from './TagStore';
import { TrashStore } from './TrashStore';

// Re-export individual stores for convenience
export { FileStore } from './FileStore';
export { UIStore } from './UIStore';
export { GitStore } from './GitStore';
export { ToastStore } from './ToastStore';
export { ScheduleStore } from './ScheduleStore';
export { DrinkReminderStore } from './DrinkReminderStore';
export { PasswordStore, type PasswordSettings } from './PasswordStore';
export { TabStore, type OpenTab } from './TabStore';
export { SearchStore, type SearchResult } from './SearchStore';
export { ExportStore, type ExportDialogState, type ExportFormat } from './ExportStore';
export { FavoriteStore } from './FavoriteStore';
export { BacklinkStore, type Wikilink, type Backlink } from './BacklinkStore';
export { KeyboardShortcutStore, type ShortcutConfig, type ShortcutAction } from './KeyboardShortcutStore';
export { TagStore, type Tag, type FileTags } from './TagStore';
export { TrashStore, type TrashItem } from './TrashStore';

export class RootStore {
  fileStore: FileStore;
  uiStore: UIStore;
  gitStore: GitStore;
  toastStore: ToastStore;
  scheduleStore: ScheduleStore;
  drinkReminderStore: DrinkReminderStore;
  passwordStore: PasswordStore;
  backlinkStore: BacklinkStore;
  keyboardShortcutStore: KeyboardShortcutStore;
  tagStore: TagStore;
  trashStore: TrashStore;

  constructor() {
    this.toastStore = new ToastStore();
    this.uiStore = new UIStore();
    this.gitStore = new GitStore(this.toastStore, this.uiStore);
    // Pass gitStore to fileStore for event-driven git status updates
    this.fileStore = new FileStore(this.toastStore, this.gitStore);
    this.scheduleStore = new ScheduleStore();
    this.drinkReminderStore = new DrinkReminderStore();
    this.passwordStore = new PasswordStore(this.toastStore);
    this.backlinkStore = new BacklinkStore();
    this.keyboardShortcutStore = new KeyboardShortcutStore();
    this.tagStore = new TagStore();
    this.trashStore = new TrashStore();
    // Inject tagStore into fileStore
    this.fileStore.tagStore = this.tagStore;
    // Inject trashStore into fileStore
    this.fileStore.trashStore = this.trashStore;
  }
}

// Create a context with null initially
export const StoreContext = createContext<RootStore | null>(null);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
