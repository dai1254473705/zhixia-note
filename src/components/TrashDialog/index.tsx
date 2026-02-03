import * as Dialog from '@radix-ui/react-dialog';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Trash2, RotateCcw, X, Clock, FileText, Folder, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export const TrashDialog = observer(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { trashStore, fileStore, toastStore } = useStore();
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);

  const trashItemsByDate = trashStore.getTrashItemsByDate();

  const handleRestore = async (itemId: string) => {
    setIsRestoring(itemId);
    try {
      const writeFile = async (path: string, content: string): Promise<boolean> => {
        const result = await window.electronAPI.saveFile(path, content);
        return result.success || false;
      };

      const success = await trashStore.restoreFromTrash(itemId, writeFile);
      if (success) {
        toastStore?.success('文件已恢复');
        await fileStore.loadFileTree(); // Refresh file tree
      } else {
        toastStore?.error('恢复文件失败');
      }
    } catch (error) {
      console.error('Restore error:', error);
      toastStore?.error('恢复文件时出错');
    } finally {
      setIsRestoring(null);
    }
  };

  const handlePermanentDelete = (itemId: string) => {
    if (confirm('确定要永久删除此文件吗？此操作无法撤销。')) {
      trashStore.permanentlyDelete(itemId);
      toastStore?.success('文件已永久删除');
    }
  };

  const handleEmptyTrash = () => {
    trashStore.emptyTrash();
    toastStore?.success('回收站已清空');
    setShowConfirmEmpty(false);
  };

  const getRelativePath = (fullPath: string): string => {
    if (!fileStore.rootPath) return fullPath;
    return fullPath.replace(fileStore.rootPath, '').replace(/^\//, '');
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  const isExpired = (deletedAt: number): boolean => {
    const now = Date.now();
    const maxAge = trashStore.autoCleanupDays * 24 * 60 * 60 * 1000;
    return now - deletedAt > maxAge;
  };

  const allTrashItems = trashStore.getAllTrashItems();
  const expiredCount = allTrashItems.filter(item => isExpired(item.deletedAt)).length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  回收站
                </Dialog.Title>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {allTrashItems.length} 个项目 · {trashStore.formattedTrashSize}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {allTrashItems.length > 0 && (
                <button
                  onClick={() => setShowConfirmEmpty(true)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="清空回收站"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <Dialog.Close
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
            {allTrashItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Trash2 size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">回收站为空</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  删除的文件会显示在这里，{trashStore.autoCleanupDays}天后自动清除
                </p>
              </div>
            ) : (
              <>
                {/* Expired items warning */}
                {expiredCount > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {expiredCount} 个项目即将过期，将在清除时永久删除
                      </p>
                    </div>
                  </div>
                )}

                {/* Trash items by date */}
                {Array.from(trashItemsByDate.entries()).map(([date, items]) => (
                  <div key={date} className="mb-6">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1">
                      {date}
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const expired = isExpired(item.deletedAt);
                        const restoring = isRestoring === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              expired
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className={`p-2 rounded-md ${
                                item.type === 'directory'
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {item.type === 'directory' ? <Folder size={18} /> : <FileText size={18} />}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {item.name}
                                  </span>
                                  {expired && (
                                    <span className="px-2 py-0.5 text-xs bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 rounded-full">
                                      即将过期
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                  <Clock size={12} />
                                  <span>{formatDate(item.deletedAt)}</span>
                                  <span>·</span>
                                  <span className="truncate">{getRelativePath(item.originalPath)}</span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleRestore(item.id)}
                                  disabled={restoring}
                                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors disabled:opacity-50"
                                  title="恢复"
                                >
                                  {restoring ? (
                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <RotateCcw size={16} />
                                  )}
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(item.id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                  title="永久删除"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Directory children */}
                            {item.type === 'directory' && item.children && item.children.length > 0 && (
                              <div className="ml-11 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 mb-2">包含 {item.children.length} 个项目</p>
                                <div className="space-y-1">
                                  {item.children.slice(0, 3).map((child) => (
                                    <div key={child.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 px-2 py-1">
                                      {child.type === 'directory' ? <Folder size={12} /> : <FileText size={12} />}
                                      <span className="truncate">{child.name}</span>
                                    </div>
                                  ))}
                                  {item.children.length > 3 && (
                                    <p className="text-xs text-gray-400 px-2">还有 {item.children.length - 3} 个项目...</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              文件会在 {trashStore.autoCleanupDays} 天后自动清除
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              关闭
            </button>
          </div>

          {/* Empty Trash Confirmation Dialog */}
          {showConfirmEmpty && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">清空回收站？</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  确定要永久删除回收站中的所有文件吗？此操作无法撤销。
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirmEmpty(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleEmptyTrash}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    确认清空
                  </button>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
