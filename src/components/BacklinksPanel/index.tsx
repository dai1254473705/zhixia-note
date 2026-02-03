import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Link2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useState, memo } from 'react';

export const BacklinksPanel = memo(observer(() => {
  const { fileStore, backlinkStore } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!fileStore.currentFile) return null;

  const fileName = fileStore.currentFile.name.replace('.md', '');
  const backlinks = backlinkStore.getBacklinks(fileName);

  if (backlinks.length === 0) return null;

  const handleBacklinkClick = (sourcePath: string) => {
    const findNode = (nodes: any[], targetPath: string): any => {
      for (const node of nodes) {
        if (node.path === targetPath) return node;
        if (node.children) {
          const found = findNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(fileStore.fileTree, sourcePath);
    if (node) {
      fileStore.selectFile(node);
    }
  };

  const getSourceFileName = (sourcePath: string): string => {
    const parts = sourcePath.split('/');
    const name = parts[parts.length - 1] || sourcePath;
    return name.replace('.md', '');
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 backdrop-blur-sm">
      <button
        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-primary" />
          <span className="font-medium text-gray-700 dark:text-gray-200">
            反向链接 ({backlinks.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-1">
          {backlinks.map((backlink, idx) => (
            <button
              key={idx}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
              onClick={() => handleBacklinkClick(backlink.sourcePath)}
            >
              <FileText size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-600 dark:text-gray-300 group-hover:text-primary dark:group-hover:text-primary transition-colors">
                {getSourceFileName(backlink.sourcePath)}
              </span>
              {backlink.alias && (
                <span className="text-xs text-gray-400 shrink-0">
                  via {backlink.alias}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}));
