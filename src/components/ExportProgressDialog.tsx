import React from 'react';
import { X, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import logo from '../assets/zhixia-logo.svg';

export interface ExportProgressItem {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface ExportProgressDialogProps {
  isOpen: boolean;
  title: string;
  currentFile?: string;
  currentProgress?: number; // 0-100 for current file
  totalProgress?: number; // 0-100 for total
  items?: ExportProgressItem[];
  status: 'exporting' | 'completed' | 'error';
  completedCount?: number;
  totalCount?: number;
  onClose: () => void;
}

export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  isOpen,
  title,
  currentFile,
  currentProgress = 0,
  totalProgress = 0,
  items,
  status,
  completedCount = 0,
  totalCount = 0,
  onClose
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return '导出完成';
      case 'error':
        return '导出失败';
      default:
        return '正在导出...';
    }
  };

  const canClose = status === 'completed' || status === 'error';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && canClose && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 w-full max-w-lg animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <img src={logo} alt="知夏笔记" className="w-8 h-8 dark:brightness-0 dark:invert" />
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </Dialog.Title>
            </div>
            {canClose && (
              <Dialog.Close asChild>
                <button
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  onClick={onClose}
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Status and Progress */}
            <div className="flex items-center gap-3 mb-4">
              {getStatusIcon()}
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {getStatusText()}
                </p>
                {status === 'exporting' && currentFile && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {currentFile}
                  </p>
                )}
                {(status === 'completed' || status === 'error') && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {completedCount} / {totalCount} 个文件
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {status === 'exporting' && (
              <>
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{completedCount} / {totalCount}</span>
                    <span>{Math.round(totalProgress)}%</span>
                  </div>
                </div>
              </>
            )}

            {/* Items List (for batch export) */}
            {items && items.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 text-sm">
                      {item.status === 'pending' && (
                        <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                      )}
                      {item.status === 'processing' && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                      {item.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                        {item.fileName}
                      </span>
                      {item.error && (
                        <span className="text-xs text-red-500 truncate" title={item.error}>
                          失败
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end rounded-b-lg">
            <button
              onClick={onClose}
              disabled={!canClose}
              className={`px-4 py-2 rounded-md transition-colors ${
                canClose
                  ? 'bg-primary hover:bg-primary/90 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {status === 'exporting' ? '导出中...' : '关闭'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// Hook to manage export progress dialog
export const useExportProgressDialog = () => {
  const [dialogState, setDialogState] = React.useState<{
    isOpen: boolean;
    title: string;
    currentFile?: string;
    currentProgress: number;
    totalProgress: number;
    items: ExportProgressItem[];
    status: 'exporting' | 'completed' | 'error';
    completedCount: number;
    totalCount: number;
  }>({
    isOpen: false,
    title: '导出',
    currentProgress: 0,
    totalProgress: 0,
    items: [],
    status: 'exporting',
    completedCount: 0,
    totalCount: 0
  });

  const open = (title: string, totalCount: number) => {
    setDialogState({
      isOpen: true,
      title,
      currentProgress: 0,
      totalProgress: 0,
      items: Array(totalCount).fill(null).map((_, i) => ({
        fileName: '',
        status: 'pending' as const
      })),
      status: 'exporting',
      completedCount: 0,
      totalCount
    });
  };

  const updateProgress = (current: number, total: number, fileName?: string) => {
    setDialogState(prev => {
      const newItems = [...prev.items];
      if (fileName && current <= newItems.length) {
        newItems[current - 1] = {
          fileName,
          status: 'processing'
        };
        // Mark previous items as success
        for (let i = 0; i < current - 1; i++) {
          if (newItems[i].status === 'pending' || newItems[i].status === 'processing') {
            newItems[i].status = 'success';
          }
        }
      }

      return {
        ...prev,
        items: newItems,
        currentFile: fileName,
        completedCount: current,
        totalProgress: total > 0 ? (current / total) * 100 : 0
      };
    });
  };

  const markItemSuccess = (index: number) => {
    setDialogState(prev => {
      const newItems = [...prev.items];
      if (newItems[index]) {
        newItems[index].status = 'success';
      }
      return { ...prev, items: newItems };
    });
  };

  const markItemError = (index: number, error: string) => {
    setDialogState(prev => {
      const newItems = [...prev.items];
      if (newItems[index]) {
        newItems[index].status = 'error';
        newItems[index].error = error;
      }
      return { ...prev, items: newItems };
    });
  };

  const complete = (success: boolean) => {
    setDialogState(prev => ({
      ...prev,
      status: success ? 'completed' : 'error'
    }));
  };

  const close = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  return {
    dialogState,
    open,
    updateProgress,
    markItemSuccess,
    markItemError,
    complete,
    close
  };
};
