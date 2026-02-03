import * as Dialog from '@radix-ui/react-dialog';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { KeyboardShortcutSettings } from '../KeyboardShortcutSettings';

export const KeyboardShortcutDialog = observer(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              快捷键设置
            </Dialog.Title>
            <Dialog.Close
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-80px)] custom-scrollbar">
            <KeyboardShortcutSettings />
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              完成
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
