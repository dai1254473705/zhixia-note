import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Preview, setWikilinkClickHandler } from './Preview';
import { EditorToolbar } from './EditorToolbar';
import { TabBar } from '../TabBar';
import { BacklinksPanel } from '../BacklinksPanel';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as prettier from "prettier/standalone";
import * as prettierPluginMarkdown from "prettier/plugins/markdown";

// 撤销/重做历史栈
const MAX_HISTORY = 50;

interface HistoryState {
  content: string;
  cursorStart: number;
  cursorEnd: number;
}

export const Editor = observer(() => {
  const { fileStore, uiStore, backlinkStore, keyboardShortcutStore, tagStore } = useStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 撤销/重做状态
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoRef = useRef(false);

  // Split Pane State
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const isResizing = useRef(false);

  // Sync Scroll State
  const isScrolling = useRef(false);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // 手动保存时更新元数据
    fileStore.saveCurrentFile(true);
  }, [fileStore]);

  // 保存当前状态到历史记录
  const saveToHistory = useCallback((content: string, cursorStart: number, cursorEnd: number) => {
    const history = historyRef.current;
    const index = historyIndexRef.current;

    // 如果正在执行撤销/重做，不保存
    if (isUndoRedoRef.current) return;

    // 如果是新文件或没有历史，初始化
    if (index === -1 || history.length === 0) {
      historyRef.current = [{ content, cursorStart, cursorEnd }];
      historyIndexRef.current = 0;
      return;
    }

    // 如果在中间位置进行了编辑，清除后面的历史
    if (index < history.length - 1) {
      historyRef.current = history.slice(0, index + 1);
    }

    // 检查内容是否真的改变了
    const lastState = history[index];
    if (lastState && lastState.content === content) {
      return;
    }

    // 添加新状态
    history.push({ content, cursorStart, cursorEnd });

    // 限制历史记录数量
    if (history.length > MAX_HISTORY) {
      history.shift();
    } else {
      historyIndexRef.current = index + 1;
    }
  }, []);

  // 撤销
  const undo = useCallback(() => {
    const history = historyRef.current;
    const index = historyIndexRef.current;

    if (index <= 0) return; // 没有更多历史可以撤销

    const prevState = history[index - 1];
    isUndoRedoRef.current = true;

    fileStore.updateContent(prevState.content);
    historyIndexRef.current = index - 1;

    setTimeout(() => {
      isUndoRedoRef.current = false;
      // 恢复光标位置
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(prevState.cursorStart, prevState.cursorEnd);
      }
    }, 0);
  }, [fileStore]);

  // 重做
  const redo = useCallback(() => {
    const history = historyRef.current;
    const index = historyIndexRef.current;

    if (index >= history.length - 1) return; // 没有更多历史可以重做

    const nextState = history[index + 1];
    isUndoRedoRef.current = true;

    fileStore.updateContent(nextState.content);
    historyIndexRef.current = index + 1;

    setTimeout(() => {
      isUndoRedoRef.current = false;
      // 恢复光标位置
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextState.cursorStart, nextState.cursorEnd);
      }
    }, 0);
  }, [fileStore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Z 撤销
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z 或 Cmd/Ctrl + Y 重做
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Check for save shortcut (customizable)
      if (keyboardShortcutStore.matchesShortcut('save', e)) {
        e.preventDefault();
        triggerSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSave, keyboardShortcutStore, undo, redo]);

  // 初始化历史记录 - 文件切换时重置历史栈
  useEffect(() => {
    if (fileStore.currentFile) {
      // 重置历史记录
      historyRef.current = [];
      historyIndexRef.current = -1;

      // 保存初始状态
      const content = fileStore.currentContent;
      const textarea = textareaRef.current;
      const cursorStart = textarea?.selectionStart || 0;
      const cursorEnd = textarea?.selectionEnd || 0;

      historyRef.current = [{ content, cursorStart, cursorEnd }];
      historyIndexRef.current = 0;
    }
  }, [fileStore.currentFile?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const content = textarea.value;
    const cursorStart = textarea.selectionStart;
    const cursorEnd = textarea.selectionEnd;

    fileStore.updateContent(content);

    // 保存到历史记录（使用 requestAnimationFrame 避免频繁触发）
    requestAnimationFrame(() => {
      saveToHistory(content, cursorStart, cursorEnd);
    });

    // Debounced Auto Save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      fileStore.saveCurrentFile();
    }, 1000);
  };

  // Sync Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!previewRef.current || isScrolling.current) return;

    const textarea = e.currentTarget;
    const percentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
    const preview = previewRef.current;
    
    preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
  };

  // Paste Handler - 支持粘贴文件
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!fileStore.currentFile) return;

    const clipboardData = e.clipboardData;
    const items = clipboardData?.items;

    if (!items) return;

    // 检查是否有文件
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    // 如果有文件，阻止默认粘贴行为
    if (files.length > 0) {
      e.preventDefault();

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      // 处理每个粘贴的文件
      for (const file of files) {
        try {
          // 将文件转为 Uint8Array
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // 保存到 assets 文件夹
          const result = await window.electronAPI.savePastedFile(
            file.name,
            uint8Array,
            fileStore.currentFile.path
          );

          if (result.success && result.data) {
            const relativePath = result.data;
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(file.name);

            // 构建插入的 markdown
            const before = text.substring(0, start);
            const after = text.substring(end);
            const insertText = isImage
              ? `![${file.name}](${relativePath})`
              : `[${file.name}](${relativePath})`;

            // 更新内容
            fileStore.updateContent(before + insertText + after);

            // 设置光标位置到插入内容之后
            setTimeout(() => {
              textarea.focus();
              const newCursorPos = start + insertText.length;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);

            // 触发保存
            triggerSave();
          } else {
            console.error('Failed to save pasted file:', result.error);
          }
        } catch (error) {
          console.error('Paste error:', error);
        }
      }
    }
  };

  const handleInsert = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const newText = before + prefix + selection + suffix + after;
    
    fileStore.updateContent(newText);
    
    // Debounced Auto Save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      fileStore.saveCurrentFile();
    }, 1000);
    
    // Restore cursor / focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length
      );
    }, 0);
  };

  const handleUpload = async (type: 'image' | 'file' = 'file') => {
    if (!fileStore.currentFile) return;

    try {
      const filters = type === 'image' 
        ? [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'svg'] }] 
        : [];

      const result = await window.electronAPI.openFile({ filters });
      if (result.data?.canceled || !result.data?.filePaths.length) return;

      const sourcePath = result.data.filePaths[0];
      const copyResult = await window.electronAPI.copyToAssets(sourcePath, fileStore.currentFile.path);
      
      if (copyResult.success && copyResult.data) {
        const relativePath = copyResult.data;
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(sourcePath);
        const fileName = sourcePath.split(/[/\\]/).pop() || 'file';
        
        const prefix = isImage ? `![${fileName}](` : `[${fileName}](`;
        const suffix = `)`;
        
        handleInsert(prefix + relativePath, suffix);
        triggerSave();
      } else {
        console.error('Upload failed:', copyResult.error);
        // Could add toast here
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleFormat = async () => {
    try {
      const formatted = await prettier.format(fileStore.currentContent, {
        parser: "markdown",
        plugins: [prettierPluginMarkdown],
      });
      fileStore.updateContent(formatted);
      triggerSave();
    } catch (error) {
      console.error('Formatting failed:', error);
    }
  };

  // Resize Handlers
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    
    const container = document.getElementById('editor-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit between 20% and 80%
    if (newRatio > 20 && newRatio < 80) {
      setSplitRatio(newRatio);
    }
  }, []);

  const stopResize = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  // Clear timeout on unmount or file change
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fileStore.currentFile?.id]);

  // Set up wikilink click handler
  useEffect(() => {
    const handleWikilinkClick = (_event: MouseEvent, target: string) => {
      // Resolve the wikilink to a file path
      const resolvedPath = backlinkStore.resolveLink(target, fileStore.fileTree);

      if (resolvedPath) {
        // Find the file node in the tree
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

        const node = findNode(fileStore.fileTree, resolvedPath);
        if (node) {
          fileStore.selectFile(node);
        }
      } else {
        // File doesn't exist - ask to create it
        const fileName = target.endsWith('.md') ? target : `${target}.md`;
        if (confirm(`文件 "${fileName}" 不存在，是否创建？`)) {
          fileStore.createFile(fileStore.currentFile?.path ? fileStore.currentFile.path.split('/').slice(0, -1).join('/') : fileStore.rootPath, fileName);
        }
      }
    };

    setWikilinkClickHandler(handleWikilinkClick);

    return () => {
      setWikilinkClickHandler(null);
    };
  }, [fileStore, backlinkStore]);

  // Build backlink and tag index when file tree is loaded
  useEffect(() => {
    if (fileStore.fileTree.length > 0 && !backlinkStore.isLoading) {
      const readFile = async (path: string): Promise<string> => {
        const result = await window.electronAPI.readFile(path);
        if (result.success && result.data) {
          return result.data;
        }
        throw new Error(result.error || 'Failed to read file');
      };
      backlinkStore.buildIndex(fileStore.fileTree, readFile);
      tagStore?.buildIndex(fileStore.fileTree, readFile);
    }
  }, [fileStore.fileTree]); // Only re-run when fileTree changes

  if (!fileStore.currentFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 text-gray-400 select-none">
        <div className="text-center">
          <p className="mb-2 text-lg">No file selected</p>
          <p className="text-sm">Select a file from the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  // Handle non-editable files (images only)
  const fileName = fileStore.currentFile.name.toLowerCase();
  const isEditable = fileName.endsWith('.md') || fileName.endsWith('.json') || fileName.endsWith('.txt');
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileStore.currentFile.name);

  if (!isEditable) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Tab Bar - Always show tabs */}
        <TabBar />

        {/* Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
           <div className="h-12 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 shrink-0">
              <span className="font-medium text-gray-700 dark:text-gray-200">{fileStore.currentFile.name}</span>
           </div>
           <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
              {isImage ? (
                 // Use media:// protocol to display local image
                 <img
                   src={`media://local${fileStore.currentFile.path}`}
                   alt={fileStore.currentFile.name}
                   className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                 />
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {fileStore.currentFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    This file type is not supported for editing or previewing yet.
                  </p>
                  <button
                    className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                    onClick={() => window.electronAPI.showItemInFolder(fileStore.currentFile!.path)}
                  >
                    Show in Folder
                  </button>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  }

  // View Mode Logic
  const showEditor = uiStore.viewMode === 'editor' || uiStore.viewMode === 'split';
  const showPreview = uiStore.viewMode === 'preview' || uiStore.viewMode === 'split';
  const showResizer = uiStore.viewMode === 'split';
  const showToolbar = uiStore.viewMode !== 'preview' && fileName.endsWith('.md'); // Only show toolbar for Markdown files

  // Calculate preview width
  const previewWidth = showResizer ? `${100 - splitRatio}%` : '100%';
  const editorWidth = showResizer ? `${splitRatio}%` : '100%';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Tab Bar */}
      <TabBar />

      {/* Toolbar Area */}
      {showToolbar && (
        <EditorToolbar onInsert={handleInsert} onUpload={handleUpload} onFormat={handleFormat} />
      )}

      {/* Split Pane Area */}
      <div id="editor-container" className="flex-1 flex overflow-hidden relative">
        {/* Editor */}
        {showEditor && (
          <div
              style={{ width: editorWidth }}
              className="h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 relative group"
          >
             <textarea
               ref={textareaRef}
               className="w-full h-full resize-none p-6 md:p-10 lg:p-12 outline-none bg-transparent text-gray-800 dark:text-gray-200 font-mono text-base leading-relaxed custom-scrollbar"
               value={fileStore.currentContent}
               onChange={handleChange}
               onScroll={handleScroll}
               onPaste={handlePaste}
               placeholder="Start writing..."
               spellCheck={false}
             />
             {fileStore.isSaving && (
               <div className="absolute top-2 right-2 text-xs text-gray-400 animate-pulse">
                 Saving...
               </div>
             )}
          </div>
        )}
        
        {/* Resizer Handle */}
        {showResizer && (
          <div 
            className="w-1 bg-gray-100 dark:bg-gray-800 cursor-col-resize z-10 flex items-center justify-center transition-colors hover:bg-[var(--color-primary)]"
            onMouseDown={startResize}
          >
            {/* Visual indicator */}
            <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Preview */}
        {showPreview && (
          <div
              style={{ width: previewWidth }}
              className="h-full flex flex-col bg-gray-50 dark:bg-gray-900/50"
          >
            <div
              ref={previewRef}
              className="flex-1 overflow-y-auto custom-scrollbar"
            >
              <Preview content={fileStore.currentContent} />
            </div>
            <BacklinksPanel />
          </div>
        )}
      </div>
    </div>
  );
});

export default Editor;
