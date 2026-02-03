import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Key, Eye, EyeOff, Plus, Edit2, Trash2, Lock, FolderOpen, Shield, Check, Copy, ExternalLink, Search } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { ConfirmDialog } from '../ConfirmDialog';
import type { PasswordEntry } from '../../types';

// Setup Master Password Dialog
const SetupMasterPasswordDialog = observer(({ isOpen, onComplete }: {
  isOpen: boolean;
  onComplete: () => void;
}) => {
  const { passwordStore } = useStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    const success = await passwordStore.setMasterPassword(password);
    if (success) {
      setPassword('');
      setConfirmPassword('');
      onComplete();
    }
  };

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 w-full max-w-md animate-in zoom-in-95 duration-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                设置主密码
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  主密码用于加密您的密码数据，请妥善保管
                </p>
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                主密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="至少6个字符"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="再次输入密码"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
            >
              设置主密码
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// Unlock Dialog
const UnlockDialog = observer(({ isOpen, onUnlock }: {
  isOpen: boolean;
  onUnlock: (password: string) => void;
}) => {
  const { passwordStore } = useStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = await passwordStore.unlock(password);
    if (success) {
      onUnlock(password);
      setPassword('');
      setError('');
    } else {
      setError('密码错误');
    }
  };

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 w-full max-w-md animate-in zoom-in-95 duration-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                解锁密码管理器
              </Dialog.Title>
              <Dialog.Description asChild>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  请输入主密码以访问您的密码
                </p>
              </Dialog.Description>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="输入主密码"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
            >
              解锁
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// Change Master Password Dialog
const ChangeMasterPasswordDialog = observer(({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { passwordStore } = useStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (newPassword.length < 6) {
      setError('新密码至少需要6个字符');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      setIsLoading(false);
      return;
    }

    const success = await passwordStore.changeMasterPassword(oldPassword, newPassword);
    if (success) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      onClose();
    } else {
      setError('原密码错误');
    }
    setIsLoading(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 w-full max-w-md animate-in zoom-in-95 duration-200 p-6">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            修改主密码
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            修改密码管理器的主密码
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                原密码
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="输入当前主密码"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="至少6个字符"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="再次输入新密码"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
                disabled={isLoading}
              >
                {isLoading ? '修改中...' : '确认修改'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// Password Entry Form Dialog
const PasswordEntryDialog = observer(({ entry, isOpen, onClose }: {
  entry?: PasswordEntry;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { passwordStore } = useStore();
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when entry changes or dialog opens/closes
  useEffect(() => {
    if (entry) {
      // Editing existing entry - load the password directly (no encryption)
      setTitle(entry.title || '');
      setUsername(entry.username || '');
      setPassword(entry.password || '');
      setEmail(entry.email || '');
      setWebsite(entry.website || '');
      setNotes(entry.notes || '');
      setShowPassword(false);
      setError('');
    } else {
      // Adding new entry - reset all fields
      setTitle('');
      setUsername('');
      setPassword('');
      setEmail('');
      setWebsite('');
      setNotes('');
      setShowPassword(false);
      setError('');
    }
  }, [entry, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!title.trim()) {
      setError('请输入标题');
      setIsLoading(false);
      return;
    }

    try {
      // Save password without encryption
      await passwordStore.savePassword({
        id: entry?.id,
        title: title.trim(),
        username: username.trim() || undefined,
        password: password,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        notes: notes.trim() || undefined,
        encrypted: false
      });

      onClose();
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 w-full max-w-md animate-in zoom-in-95 duration-200 p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {entry ? '编辑密码' : '添加密码'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {entry ? '编辑已保存的密码信息' : '添加新的密码到密码管理器'}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                标题 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="例如：Google 账号"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="用户名或账号"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                密码 *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                  placeholder="密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="邮箱地址"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                网址
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                备注
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100 resize-none"
                rows={3}
                placeholder="额外信息..."
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
                disabled={isLoading}
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// Password Item Card
const PasswordItem = observer(({ entry, onEdit, onDelete }: {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-primary" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{entry.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="编辑"
          >
            <Edit2 size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="删除"
          >
            <Trash2 size={14} className="text-gray-500 hover:text-red-500" />
          </button>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        {entry.username && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="w-16 shrink-0">用户名:</span>
            <span className="truncate">{entry.username}</span>
          </div>
        )}
        {entry.email && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="w-16 shrink-0">邮箱:</span>
            <span className="truncate">{entry.email}</span>
          </div>
        )}
        {entry.website && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className="w-16 shrink-0">网址:</span>
            <a
              href={entry.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary hover:underline flex items-center gap-1"
            >
              {entry.website}
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span className="w-16 shrink-0">密码:</span>
          <span className="flex-1 flex items-center gap-2">
            <span className="font-mono">{showPassword ? entry.password : '••••••••'}</span>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title={showPassword ? '隐藏' : '显示'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="复制"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </span>
        </div>

        {entry.notes && (
          <div className="pt-2 text-gray-500 dark:text-gray-400 text-xs border-t border-gray-100 dark:border-gray-700 mt-2">
            {entry.notes}
          </div>
        )}
      </div>
    </div>
  );
});

// Main Password Manager Component
export const PasswordManager = observer(() => {
  const { passwordStore } = useStore();
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | undefined>();
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryId: string;
    entryTitle: string;
  }>({
    isOpen: false,
    entryId: '',
    entryTitle: ''
  });

  useEffect(() => {
    passwordStore.initialize();
  }, [passwordStore]);

  const handleUnlock = async (password: string) => {
    await passwordStore.unlock(password);
  };

  const handleLock = () => {
    passwordStore.lock();
  };

  const handleEditEntry = (entry: PasswordEntry) => {
    setEditingEntry(entry);
    setShowEntryDialog(true);
  };

  const handleDeleteEntry = async (id: string) => {
    const entry = passwordStore.passwords.find(p => p.id === id);
    if (entry) {
      setDeleteConfirm({
        isOpen: true,
        entryId: id,
        entryTitle: entry.title
      });
    }
  };

  const confirmDelete = async () => {
    await passwordStore.deletePassword(deleteConfirm.entryId);
    setDeleteConfirm({ isOpen: false, entryId: '', entryTitle: '' });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, entryId: '', entryTitle: '' });
  };

  const handleAddEntry = () => {
    setEditingEntry(undefined);
    setShowEntryDialog(true);
  };

  const handleCloseEntryDialog = () => {
    setShowEntryDialog(false);
    setEditingEntry(undefined);
  };

  const handleOpenDataLocation = async () => {
    await passwordStore.openDataFileLocation();
  };

  // Setup flow
  if (!passwordStore.isInitialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  // Show setup dialog if no master password
  if (!passwordStore.masterPasswordSet && !showSetupDialog) {
    return (
      <>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Shield className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            设置主密码
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
            首次使用需要设置主密码来保护您的密码数据
          </p>
          <button
            onClick={() => setShowSetupDialog(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
          >
            立即设置
          </button>
        </div>
        <SetupMasterPasswordDialog
          isOpen={showSetupDialog}
          onComplete={() => setShowSetupDialog(false)}
        />
      </>
    );
  }

  // Show unlock dialog if locked
  if (passwordStore.isLocked) {
    return (
      <UnlockDialog
        isOpen={true}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 pr-12">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              密码管理器
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChangePasswordDialog(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Shield size={16} />
              修改密码
            </button>
            <button
              onClick={handleLock}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Lock size={16} />
              锁定
            </button>
            <button
              onClick={handleOpenDataLocation}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="打开数据文件位置"
            >
              <FolderOpen size={16} />
              打开文件位置
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={passwordStore.searchQuery}
            onChange={(e) => passwordStore.setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-gray-100"
            placeholder="搜索密码..."
          />
        </div>
      </div>

      {/* Password List */}
      <div className="flex-1 overflow-y-auto p-4">
        {passwordStore.filteredPasswords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <Key className="w-12 h-12 text-gray-300 mb-3" />
            <p>{passwordStore.searchQuery ? '未找到匹配的密码' : '还没有保存任何密码'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {passwordStore.filteredPasswords.map((entry) => (
              <PasswordItem
                key={entry.id}
                entry={entry}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="absolute bottom-6 right-6">
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg transition-colors"
        >
          <Plus size={20} />
          添加密码
        </button>
      </div>

      {/* Setup Dialog */}
      <SetupMasterPasswordDialog
        isOpen={showSetupDialog}
        onComplete={() => setShowSetupDialog(false)}
      />

      {/* Add/Edit Dialog */}
      <PasswordEntryDialog
        entry={editingEntry}
        isOpen={showEntryDialog}
        onClose={handleCloseEntryDialog}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="删除密码"
        message={`确定要删除 "${deleteConfirm.entryTitle}" 吗？此操作无法撤销。`}
        confirmLabel="删除"
        cancelLabel="取消"
        type="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Change Master Password Dialog */}
      <ChangeMasterPasswordDialog
        isOpen={showChangePasswordDialog}
        onClose={() => setShowChangePasswordDialog(false)}
      />
    </div>
  );
});

export default PasswordManager;
