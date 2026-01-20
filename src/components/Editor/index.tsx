import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Preview } from './Preview';
import { EditorToolbar } from './EditorToolbar';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as prettier from "prettier/standalone";
import * as prettierPluginMarkdown from "prettier/plugins/markdown";

export const Editor = observer(() => {
  const { fileStore, uiStore } = useStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Split Pane State
  const [splitRatio, setSplitRatio] = useState(50); // percentage
  const isResizing = useRef(false);

  // Sync Scroll State
  const isScrolling = useRef(false);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    fileStore.saveCurrentFile();
  }, [fileStore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        triggerSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    fileStore.updateContent(e.target.value);
    
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

  // Handle non-markdown files (Preview only)
  if (!fileStore.currentFile.name.endsWith('.md')) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileStore.currentFile.name);
    
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
         <div className="h-12 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 shrink-0">
            <span className="font-medium text-gray-700 dark:text-gray-200">{fileStore.currentFile.name}</span>
         </div>
         <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
            {isImage ? (
               // Use media:// protocol to display local image
               // We need to construct the URL manually since we don't have it in fileStore yet (only path)
               // But wait, fileStore.currentFile.path is absolute path.
               // We need to use the same logic as Preview.tsx or simpler.
               // Preview.tsx uses: media://local/Users/...
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
    );
  }

  // View Mode Logic
  const showEditor = uiStore.viewMode === 'editor' || uiStore.viewMode === 'split';
  const showPreview = uiStore.viewMode === 'preview' || uiStore.viewMode === 'split';
  const showResizer = uiStore.viewMode === 'split';
  const showToolbar = uiStore.viewMode !== 'preview';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar Area */}
      {showToolbar && (
        <EditorToolbar onInsert={handleInsert} onUpload={handleUpload} onFormat={handleFormat} />
      )}

      {/* Split Pane Area */}
      <div id="editor-container" className="flex-1 flex overflow-hidden relative">
        {/* Auto Saving Overlay */}
        {fileStore.isAutoSaving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Auto Saving...</p>
            </div>
          </div>
        )}

        {/* Editor */}
        {showEditor && (
          <div 
              style={{ width: showResizer ? `${splitRatio}%` : '100%' }} 
              className="h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 relative group"
          >
             <textarea 
               ref={textareaRef}
               className="w-full h-full resize-none p-6 md:p-10 lg:p-12 outline-none bg-transparent text-gray-800 dark:text-gray-200 font-mono text-base leading-relaxed custom-scrollbar"
               value={fileStore.currentContent}
               onChange={handleChange}
               onScroll={handleScroll}
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
              style={{ width: showResizer ? `${100 - splitRatio}%` : '100%' }} 
              className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900/50 custom-scrollbar"
              ref={previewRef}
          >
            <Preview content={fileStore.currentContent} />
          </div>
        )}
      </div>
    </div>
  );
});

export default Editor;
