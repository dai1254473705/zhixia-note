import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { X, Hash, Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface TagDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TagDrawer = observer(({ isOpen, onClose }: TagDrawerProps) => {
  const { tagStore, fileStore } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const allTags = tagStore.getAllTags();

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, '');
    if (!tag || !fileStore.currentFile) return;

    const currentTags = tagStore.getFileTags(fileStore.currentFile.path);
    if (!currentTags.includes(tag)) {
      const updatedTags = [...currentTags, tag];

      let content = fileStore.currentContent;
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (frontmatterMatch) {
        let frontmatter = frontmatterMatch[1];
        if (frontmatter.includes('tags:')) {
          frontmatter = frontmatter.replace(
            /tags:\s*\[([^\]]*)\]/,
            (_match: string, existing: string) => {
              const existingTags = existing
                .split(',')
                .map((t: string) => t.trim().replace(/^["']|["']$/g, ''))
                .filter((t: string) => t);
              return `tags: [${[...existingTags, tag].map((t: string) => `"${t}"`).join(', ')}]`;
            }
          );
        } else {
          frontmatter += `\ntags: ["${tag}"]`;
        }
        content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
      } else {
        content = `---\ntags: ["${tag}"]\n---\n\n${content}`;
      }

      fileStore.updateContent(content);
      tagStore.updateFileTags(fileStore.currentFile.path, updatedTags);
    }

    setNewTag('');
    setIsAdding(false);
  }, [newTag, fileStore, tagStore]);

  const handleRemoveTag = useCallback((tagName: string) => {
    if (!fileStore.currentFile) return;

    const currentTags = tagStore.getFileTags(fileStore.currentFile.path);
    const updatedTags = currentTags.filter(t => t !== tagName);

    let content = fileStore.currentContent;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      let frontmatter = frontmatterMatch[1];
      if (frontmatter.includes('tags:')) {
        if (updatedTags.length === 0) {
          frontmatter = frontmatter.replace(/tags:\s*\[.*?\]\n?/, '');
        } else {
          frontmatter = frontmatter.replace(
            /tags:\s*\[([^\]]*)\]/,
            `tags: [${updatedTags.map(t => `"${t}"`).join(', ')}]`
          );
        }
        if (frontmatter.trim() === '' || frontmatter.trim() === '\n') {
          content = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
        } else {
          content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}---`);
        }
      }
    }

    fileStore.updateContent(content);
    tagStore.updateFileTags(fileStore.currentFile.path, updatedTags);
  }, [fileStore, tagStore]);

  const handleTagClick = useCallback((tagName: string) => {
    if (tagStore.selectedTag === tagName) {
      tagStore.setSelectedTag(null);
    } else {
      tagStore.setSelectedTag(tagName);
    }
  }, [tagStore]);

  const currentFileTags = fileStore.currentFile
    ? tagStore.getFileTags(fileStore.currentFile.path)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TagIcon size={18} className="text-primary" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">标签管理</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="关闭"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto custom-scrollbar" style={{ height: 'calc(100% - 65px)' }}>
          {/* Current File Tags */}
          {fileStore.currentFile && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
                当前文件标签
                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Plus size={12} />
                  {isAdding ? '取消' : '添加'}
                </button>
              </h3>

              {isAdding && (
                <div className="flex gap-2 mb-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                      if (e.key === 'Escape') setIsAdding(false);
                    }}
                    placeholder="输入标签名..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    添加
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {currentFileTags.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">暂无标签</p>
                ) : (
                  currentFileTags.map(tag => {
                    const color = tagStore.getTagColor(tag);
                    return (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full font-medium transition-all hover:scale-105"
                        style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30` }}
                      >
                        #{tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:bg-white/30 rounded-full p-0.5 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* All Tags */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center justify-between">
              所有标签 ({allTags.length})
              {tagStore.selectedTag && (
                <button
                  onClick={() => tagStore.setSelectedTag(null)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  <X size={12} />
                  清除筛选
                </button>
              )}
            </h3>

            {tagStore.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : allTags.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">暂无标签</p>
            ) : (
              <div className="space-y-2">
                {allTags.map(tag => {
                  const isSelected = tagStore.selectedTag === tag.name;
                  return (
                    <button
                      key={tag.name}
                      onClick={() => handleTagClick(tag.name)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-all",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        isSelected ? "shadow-sm" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                      style={{
                        backgroundColor: isSelected ? tag.color : '',
                        color: isSelected ? 'white' : '',
                      }}
                    >
                      <Hash size={14} className={isSelected ? "opacity-80" : "opacity-60"} />
                      <span className="flex-1 text-left font-medium">{tag.name}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        isSelected ? "bg-white/20" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                      )}>
                        {tag.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Tag Hint */}
          {tagStore.selectedTag && (
            <div className="mt-6 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Hash size={14} className="text-primary" />
                <span className="text-gray-700 dark:text-gray-300">
                  正在筛选: <strong className="text-primary">{tagStore.selectedTag}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
