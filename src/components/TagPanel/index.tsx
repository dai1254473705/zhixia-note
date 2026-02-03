import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { X, Hash, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';

export const TagPanel = observer(() => {
  const { tagStore, fileStore } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all tags sorted by count
  const allTags = tagStore.getAllTags();

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Handle file content changes to update tags
  useEffect(() => {
    if (fileStore.currentFile && fileStore.currentContent) {
      const tags = tagStore.parseTagsFromContent(fileStore.currentContent);
      tagStore.updateFileTags(fileStore.currentFile.path, tags);
    }
  }, [fileStore.currentFile?.path, fileStore.currentContent]);

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, '');
    if (!tag || !fileStore.currentFile) return;

    const currentTags = tagStore.getFileTags(fileStore.currentFile.path);
    if (!currentTags.includes(tag)) {
      const updatedTags = [...currentTags, tag];

      // Update frontmatter in content
      let content = fileStore.currentContent;
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (frontmatterMatch) {
        // Existing frontmatter
        let frontmatter = frontmatterMatch[1];
        if (frontmatter.includes('tags:')) {
          // Update existing tags array
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
          // Add tags to frontmatter
          frontmatter += `\ntags: ["${tag}"]`;
        }
        content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter}\n---`);
      } else {
        // No frontmatter, add it
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

    // Update content
    let content = fileStore.currentContent;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      let frontmatter = frontmatterMatch[1];
      if (frontmatter.includes('tags:')) {
        if (updatedTags.length === 0) {
          // Remove tags line entirely
          frontmatter = frontmatter.replace(/tags:\s*\[.*?\]\n?/, '');
        } else {
          // Update tags array
          frontmatter = frontmatter.replace(
            /tags:\s*\[([^\]]*)\]/,
            `tags: [${updatedTags.map(t => `"${t}"`).join(', ')}]`
          );
        }
        // Check if frontmatter is now empty
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
    <div className="space-y-4">
      {/* Current File Tags */}
      {fileStore.currentFile && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">当前文件标签</span>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-xs text-primary hover:underline"
            >
              {isAdding ? '取消' : '+ 添加'}
            </button>
          </div>
          <div className="p-3 min-h-[60px]">
            {isAdding && (
              <div className="flex gap-2 mb-2">
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
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  添加
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {currentFileTags.length === 0 ? (
                <p className="text-sm text-gray-400">暂无标签</p>
              ) : (
                currentFileTags.map(tag => {
                  const color = tagStore.getTagColor(tag);
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      #{tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:bg-white/20 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Tags */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">所有标签</span>
          {tagStore.selectedTag && (
            <button
              onClick={() => tagStore.setSelectedTag(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <X size={12} />
              清除筛选
            </button>
          )}
        </div>
        <div className="p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
          {tagStore.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          ) : allTags.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无标签</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => {
                const isSelected = tagStore.selectedTag === tag.name;
                return (
                  <button
                    key={tag.name}
                    onClick={() => handleTagClick(tag.name)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                      isSelected
                        ? 'ring-2 ring-offset-1 ring-primary'
                        : 'hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: isSelected ? tag.color : `${tag.color}20`,
                      color: isSelected ? 'white' : tag.color,
                    }}
                    title={`${tag.count} 个文件`}
                  >
                    <Hash size={10} />
                    {tag.name}
                    <span className="opacity-60">({tag.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filter hint */}
      {tagStore.selectedTag && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 flex items-center gap-2">
          <Hash size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-300">
            正在筛选标签: <strong>{tagStore.selectedTag}</strong>
          </span>
          <button
            onClick={() => tagStore.setSelectedTag(null)}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            清除
          </button>
        </div>
      )}
    </div>
  );
});
