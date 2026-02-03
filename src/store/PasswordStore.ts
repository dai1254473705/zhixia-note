import { makeAutoObservable, runInAction } from 'mobx';
import type { ToastStore } from './ToastStore';

// Password entry interface
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

// Settings interface
export interface PasswordSettings {
  masterPasswordHash?: string; // Hashed master password
  encryptionSalt?: string; // Unique salt for encryption (generated per user)
  encryptionEnabled: boolean;
  autoLockMinutes: number; // Auto-lock after inactivity
}

export class PasswordStore {
  passwords: PasswordEntry[] = [];
  settings: PasswordSettings = {
    encryptionEnabled: false,
    autoLockMinutes: 5
  };
  isLocked: boolean = true;
  isInitialized: boolean = false;
  isLoading: boolean = false;
  masterPasswordSet: boolean = false;
  lastActivity: number = Date.now();
  searchQuery: string = '';

  private toastStore: ToastStore;

  constructor(toastStore: ToastStore) {
    makeAutoObservable(this);
    this.toastStore = toastStore;
    this.checkAutoLock();
  }

  // Check for auto-lock
  private checkAutoLock() {
    setInterval(() => {
      if (!this.isLocked && this.settings.encryptionEnabled && this.settings.autoLockMinutes > 0) {
        const inactiveTime = (Date.now() - this.lastActivity) / 1000 / 60;
        if (inactiveTime >= this.settings.autoLockMinutes) {
          this.lock();
        }
      }
    }, 60000); // Check every minute
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  // Initialize - check if data file exists
  async initialize() {
    // Reset initialization state to allow re-initialization
    this.isInitialized = false;
    this.isLoading = true;

    try {
      const loadRes = await window.electronAPI.loadPasswordData();
      runInAction(() => {
        if (loadRes.success && loadRes.data) {
          this.passwords = loadRes.data.passwords || [];
          // Merge loaded settings with defaults (loaded values take precedence)
          this.settings = {
            encryptionEnabled: loadRes.data.settings.encryptionEnabled ?? false,
            autoLockMinutes: loadRes.data.settings.autoLockMinutes ?? 5,
            masterPasswordHash: loadRes.data.settings.masterPasswordHash,
            encryptionSalt: loadRes.data.settings.encryptionSalt
          };
          this.masterPasswordSet = !!this.settings.masterPasswordHash;
          // Sync isLocked state with masterPasswordSet
          if (this.masterPasswordSet && this.isLocked) {
            // Keep locked if master password is set
          } else if (!this.masterPasswordSet) {
            // Not locked if no master password
            this.isLocked = false;
          }
        } else {
          // No data found, use defaults
          this.isLocked = false;
          this.masterPasswordSet = false;
        }
        this.isInitialized = true;
        this.isLoading = false;
      });
    } catch (error) {
      console.error('Failed to initialize password store:', error);
      runInAction(() => {
        this.isLoading = false;
        this.isInitialized = true;
        this.isLocked = false;
        this.masterPasswordSet = false;
      });
    }
  }

  // Set up master password
  async setMasterPassword(password: string) {
    try {
      // Generate a unique salt for this user
      const saltRes = await window.electronAPI.generateEncryptionSalt();
      if (!saltRes.success || !saltRes.data) {
        this.toastStore.error('生成加密密钥失败');
        return false;
      }

      // Hash the master password for verification
      const res = await window.electronAPI.hashPassword(password);
      if (res.success && res.data) {
        runInAction(() => {
          this.settings.masterPasswordHash = res.data;
          this.settings.encryptionSalt = saltRes.data;
          this.masterPasswordSet = true;
          this.settings.encryptionEnabled = true;
          this.isLocked = false; // Auto-unlock after setting master password
          this.lastActivity = Date.now();
        });
        await this.saveData();
        this.toastStore.success('主密码设置成功');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to set master password:', error);
      this.toastStore.error('设置主密码失败');
      return false;
    }
  }

  // Change master password
  async changeMasterPassword(oldPassword: string, newPassword: string) {
    if (!this.settings.masterPasswordHash) return false;

    // Verify old password
    const verifyRes = await window.electronAPI.verifyPassword(oldPassword, this.settings.masterPasswordHash);
    if (!verifyRes.success || !verifyRes.data) {
      this.toastStore.error('原密码错误');
      return false;
    }

    // Generate a new salt for security
    const saltRes = await window.electronAPI.generateEncryptionSalt();
    if (!saltRes.success || !saltRes.data) {
      this.toastStore.error('生成加密密钥失败');
      return false;
    }

    // Re-encrypt all passwords with new password
    const newHashRes = await window.electronAPI.hashPassword(newPassword);
    if (!newHashRes.success || !newHashRes.data) return false;

    runInAction(() => {
      this.settings.masterPasswordHash = newHashRes.data;
      this.settings.encryptionSalt = saltRes.data;
    });

    await this.saveData();
    this.toastStore.success('主密码已更改');
    return true;
  }

  // Unlock with master password
  async unlock(password: string) {
    if (!this.settings.masterPasswordHash) {
      // No master password set - this shouldn't happen if UI logic is correct
      runInAction(() => {
        this.isLocked = false;
        this.masterPasswordSet = false;
      });
      return false; // Return false to indicate no password verification happened
    }

    const res = await window.electronAPI.verifyPassword(password, this.settings.masterPasswordHash);
    if (res.success && res.data) {
      runInAction(() => {
        this.isLocked = false;
        this.lastActivity = Date.now();
      });
      return true;
    }
    return false;
  }

  // Lock the password manager
  lock() {
    runInAction(() => {
      this.isLocked = true;
    });
  }

  // Encrypt a password with master password
  async encryptPasswordValue(password: string, masterPassword: string): Promise<string> {
    const res = await window.electronAPI.encryptPassword(password, masterPassword);
    return res.success && res.data ? res.data : password;
  }

  // Decrypt a password with master password
  async decryptPasswordValue(encryptedPassword: string, masterPassword: string): Promise<string> {
    const res = await window.electronAPI.decryptPassword(encryptedPassword, masterPassword);
    return res.success && res.data ? res.data : encryptedPassword;
  }

  // Add or update a password entry
  async savePassword(entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    this.updateActivity();

    const now = new Date().toISOString();
    const existingIndex = this.passwords.findIndex(p => p.id === entry.id);

    if (entry.id && existingIndex >= 0) {
      // Update existing
      runInAction(() => {
        this.passwords[existingIndex] = {
          ...this.passwords[existingIndex],
          ...entry,
          updatedAt: now
        };
      });
    } else {
      // Add new
      runInAction(() => {
        this.passwords.push({
          ...entry,
          id: `pwd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now
        });
      });
    }

    await this.saveData();
    this.toastStore.success(entry.id ? '密码已更新' : '密码已保存');
  }

  // Delete a password entry
  async deletePassword(id: string) {
    this.updateActivity();
    runInAction(() => {
      this.passwords = this.passwords.filter(p => p.id !== id);
    });
    await this.saveData();
    this.toastStore.success('密码已删除');
  }

  // Toggle encryption for a password entry
  async togglePasswordEncryption(id: string, masterPassword: string) {
    this.updateActivity();
    const entry = this.passwords.find(p => p.id === id);
    if (!entry) return;

    if (entry.encrypted) {
      // Decrypt
      const decrypted = await this.decryptPasswordValue(entry.password, masterPassword);
      runInAction(() => {
        entry.password = decrypted;
        entry.encrypted = false;
      });
    } else {
      // Encrypt
      const encrypted = await this.encryptPasswordValue(entry.password, masterPassword);
      runInAction(() => {
        entry.password = encrypted;
        entry.encrypted = true;
      });
    }

    await this.saveData();
    return !entry.encrypted; // Return new encryption state (toggled)
  }

  // Save data to file
  async saveData() {
    try {
      await window.electronAPI.savePasswordData({
        passwords: JSON.parse(JSON.stringify(this.passwords)),
        settings: {
          encryptionEnabled: this.settings.encryptionEnabled,
          autoLockMinutes: this.settings.autoLockMinutes,
          masterPasswordHash: this.settings.masterPasswordHash,
          encryptionSalt: this.settings.encryptionSalt
        }
      });
    } catch (error) {
      console.error('Failed to save password data:', error);
      this.toastStore.error('保存失败');
    }
  }

  // Open data file location
  async openDataFileLocation() {
    const res = await window.electronAPI.openPasswordDataLocation();
    if (!res.success) {
      this.toastStore.error('无法打开文件位置');
    }
  }

  // Get filtered passwords
  get filteredPasswords(): PasswordEntry[] {
    if (!this.searchQuery) return this.passwords;

    const query = this.searchQuery.toLowerCase();
    return this.passwords.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.username?.toLowerCase().includes(query) ||
      p.website?.toLowerCase().includes(query) ||
      p.email?.toLowerCase().includes(query)
    );
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  // Update settings
  async updateSettings(settings: Partial<PasswordSettings>) {
    this.updateActivity();
    runInAction(() => {
      this.settings = { ...this.settings, ...settings };
    });
    await this.saveData();
  }
}
