import { observer } from 'mobx-react-lite';
import { useStore } from '../store';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { memo } from 'react';

export const TabBar = memo(observer(() => {
  const { fileStore } = useStore();

  if (fileStore.openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      <div className="flex items-center gap-1 px-2">
        {fileStore.openTabs.map((tab) => {
          const isActive = fileStore.activeTabId === tab.file.id;
          const isModified = tab.isModified || fileStore.unsavedFilePaths.has(tab.file.path);
          const displayName = tab.file.name.replace(/\.md$/, '');

          return (
            <div
              key={tab.file.id}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-2 rounded-t-md text-sm cursor-pointer transition-all select-none min-w-0 max-w-[200px]",
                "border-t-2 border-l-2 border-r-2",
                isActive
                  ? "bg-white dark:bg-gray-900 border-primary text-primary"
                  : "bg-transparent border-transparent hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}
              onClick={() => fileStore.switchTab(tab.file.id)}
            >
              {/* Tab content */}
              <span className="flex-1 truncate font-medium">
                {displayName}
              </span>

              {/* Modified indicator */}
              {isModified && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="有未保存的更改" />
              )}

              {/* Close button */}
              <button
                className={cn(
                  "p-0.5 rounded transition-colors shrink-0",
                  "opacity-0 group-hover:opacity-100",
                  isActive && "opacity-100",
                  "hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  fileStore.closeTab(tab.file.id);
                }}
                title="关闭标签"
              >
                <X size={14} />
              </button>

              {/* Active indicator bottom bar */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}));
