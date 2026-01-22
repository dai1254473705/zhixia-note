import type { ThemeMode } from '../types';
import { observer } from 'mobx-react-lite';
import { useStore } from '../store';
import { RefreshCw, Check, AlertCircle, Sun, Moon, Monitor, Palette, Cloud, UploadCloud, Eye, Edit3, Columns, HelpCircle, Download, FileCode, FileText, Loader2, Settings, FileSearch, FolderOpen } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../utils/cn';
import { THEME_COLORS } from '../constants/theme';
import { useState } from 'react';
import { marked, Renderer } from 'marked';

interface ToolbarProps {
  onHelpClick?: () => void;
}

export const Toolbar = observer(({ onHelpClick }: ToolbarProps) => {
  const { gitStore, uiStore, fileStore } = useStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleSync = () => {
    gitStore.sync();
  };

  const getSyncStatusUI = () => {
    if (gitStore.isSyncing) {
      if (gitStore.syncStep === 'committing') {
        return {
          icon: <RefreshCw size={16} className="animate-spin text-amber-500" />,
          text: `Committing ${gitStore.status.modified} files...`,
          className: "text-amber-600 bg-amber-50 dark:bg-amber-900/10"
        };
      }
      return {
        icon: <RefreshCw size={16} className="animate-spin text-primary" />,
        text: 'Pushing to cloud...',
        className: "text-primary bg-primary/10"
      };
    }
    
    if (gitStore.status.status === 'error') {
      return {
        icon: <AlertCircle size={16} className="text-red-500" />,
        text: 'Sync Error',
        className: "text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100"
      };
    }

    if (gitStore.status.modified > 0) {
      return {
        icon: <Cloud size={16} className="text-amber-500" />,
        text: `${gitStore.status.modified} Unsaved`,
        className: "text-amber-600 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100"
      };
    }

    if (gitStore.status.ahead > 0) {
      return {
        icon: <UploadCloud size={16} className="text-blue-500" />,
        text: `${gitStore.status.ahead} Ahead`,
        className: "text-blue-600 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100"
      };
    }

    return {
      icon: <Check size={16} className="text-emerald-500" />,
      text: 'Synced',
      className: "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
    };
  };

  const statusUI = getSyncStatusUI();

  const handleExport = async (type: 'html' | 'pdf') => {
    if (!fileStore.currentFile || !fileStore.currentContent) return;

    setIsExporting(true);
    try {
      // Create custom renderer for image path conversion
      const renderer = new Renderer();

      renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
        if (!href) return text;

        let src = href;
        let style = '';

        // Parse query params for size (e.g. ?w=100px)
        try {
          const urlObj = new URL(href, 'http://dummy');
          const width = urlObj.searchParams.get('w');
          const height = urlObj.searchParams.get('h');

          if (width) style += `width: ${width};`;
          if (height) style += `height: ${height};`;
        } catch {
          // Ignore parsing errors
        }

        // If it's a relative path and not a web URL or data URL or media:// URL
        if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('media:')) {
          if (fileStore.currentFile) {
            const currentFilePath = fileStore.currentFile.path;
            const lastSlashIndex = currentFilePath.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
              const currentDir = currentFilePath.substring(0, lastSlashIndex);
              const absolutePath = `${currentDir}/${href}`;
              // Use media://local protocol
              src = `media://local${absolutePath}`;
            }
          }
        }

        return `<img src="${src}" alt="${text}" title="${title || ''}" style="${style}" />`;
      };

      // Generate HTML with custom renderer
      const htmlBody = await marked.parse(fileStore.currentContent, { renderer });
      
      // Basic Template
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${fileStore.currentFile.name}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
    padding: 2em;
    max-width: 900px;
    margin: 0 auto;
    line-height: 1.6;
    color: #24292f;
    background-color: #ffffff;
  }
  
  /* GitHub Markdown CSS Style */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
    color: #24292f;
  }
  
  h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.875em; }
  h6 { font-size: 0.85em; color: #57606a; }
  
  p { margin-top: 0; margin-bottom: 16px; }
  
  code {
    padding: .2em .4em;
    margin: 0;
    font-size: 85%;
    background-color: rgba(175, 184, 193, 0.2);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  }
  
  pre {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #f6f8fa;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  
  pre code {
    background-color: transparent;
    padding: 0;
  }
  
  blockquote {
    padding: 0 1em;
    color: #57606a;
    border-left: .25em solid #d0d7de;
    margin: 0 0 16px 0;
  }
  
  img {
    max-width: 100%;
    box-sizing: content-box;
    background-color: #fff;
    border-style: none;
  }
  
  table {
    border-spacing: 0;
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 16px;
    display: block;
    overflow: auto;
  }
  
  table th, table td {
    padding: 6px 13px;
    border: 1px solid #d0d7de;
  }
  
  table tr {
    background-color: #fff;
    border-top: 1px solid #d8dee4;
  }
  
  table tr:nth-child(2n) {
    background-color: #f6f8fa;
  }
  
  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: #d0d7de;
    border: 0;
  }
  
  a {
    color: #0969da;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  ul, ol {
    padding-left: 2em;
    margin-top: 0;
    margin-bottom: 16px;
  }
  
  li > p {
    margin-top: 16px;
  }
  
  li + li {
    margin-top: .25em;
  }
  
  /* Task lists */
  ul.contains-task-list {
    list-style-type: none;
    padding-left: 0;
  }
  
  .task-list-item-checkbox {
    margin: 0 .2em .25em -1.6em;
    vertical-align: middle;
  }

  @media print {
    body {
      padding: 0;
      max-width: 100%;
    }
  }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

      let res;
      if (type === 'html') {
        res = await window.electronAPI.exportHtml(fullHtml, fileStore.currentFile.name.replace('.md', '.html'));
      } else {
        res = await window.electronAPI.exportPdf(fullHtml, fileStore.currentFile.name.replace('.md', '.pdf'));
      }

      if (res.success) {
        fileStore.toastStore?.success(`已导出 ${fileStore.currentFile.name.replace('.md', type === 'html' ? '.html' : '.pdf')}`);
      } else if (res.error !== 'Canceled') {
        fileStore.toastStore?.error(`导出失败: ${res.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      fileStore.toastStore?.error(`导出错误: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenLogDirectory = async () => {
    const res = await window.electronAPI.openLogDirectory();
    if (!res.success) {
      fileStore.toastStore?.error('无法打开日志目录');
    }
  };

  return (
    <>
      <div className="h-12 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 shrink-0 z-10 pl-24">
         {/* Left: Brand / Breadcrumbs */}
        <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200 select-none">
          {fileStore.projectName && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm text-gray-400 dark:text-gray-500">/</span>
              <span className="text-sm font-semibold">{fileStore.projectName}</span>
            </div>
          )}
        </div>

         {/* Right: Actions */}
         <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 mr-2">
              <button
                onClick={() => uiStore.setViewMode('editor')}
                className={cn(
                  "p-1.5 rounded-sm transition-all",
                  uiStore.viewMode === 'editor' 
                    ? "bg-white dark:bg-gray-700 shadow-sm text-primary" 
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                title="Editor Only"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => uiStore.setViewMode('split')}
                className={cn(
                  "p-1.5 rounded-sm transition-all",
                  uiStore.viewMode === 'split' 
                    ? "bg-white dark:bg-gray-700 shadow-sm text-primary" 
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                title="Split View"
              >
                <Columns size={16} />
              </button>
              <button
                onClick={() => uiStore.setViewMode('preview')}
                className={cn(
                  "p-1.5 rounded-sm transition-all",
                  uiStore.viewMode === 'preview' 
                    ? "bg-white dark:bg-gray-700 shadow-sm text-primary" 
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                title="Preview Only"
              >
                <Eye size={16} />
              </button>
            </div>

            {/* Sync Button */}
            <button 
              onClick={handleSync}
              disabled={gitStore.isSyncing}
              className={cn(
                 "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                 statusUI.className
              )}
              title={gitStore.status.errorMessage || `Last synced: ${gitStore.status.lastSyncTime ? new Date(gitStore.status.lastSyncTime).toLocaleTimeString() : 'Never'}`}
            >
               {statusUI.icon}
               <span>{statusUI.text}</span>
            </button>

            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

            {/* Export Menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500 hover:text-primary"
                  title="Export"
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[160px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded outline-none"
                    onSelect={() => handleExport('html')}
                  >
                    <FileCode size={14} className="mr-2" /> Export to HTML
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded outline-none"
                    onSelect={() => handleExport('pdf')}
                  >
                    <FileText size={14} className="mr-2" /> Export to PDF
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Settings / Logs Menu */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500 hover:text-primary"
                  title="设置"
                >
                  <Settings size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[200px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                  align="end"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded outline-none"
                    onSelect={handleOpenLogDirectory}
                  >
                    <FolderOpen size={14} className="mr-2" />
                    打开日志目录
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Help Button */}
            <button
              onClick={onHelpClick}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500 hover:text-primary"
              title="帮助文档 (⌘+H)"
            >
              <HelpCircle size={18} />
            </button>

            {/* Unified Theme Picker */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                 <button 
                   className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors flex items-center gap-2"
                   style={{ color: 'var(--color-primary)' }}
                   title="Theme Settings"
                 >
                   <Palette size={18} />
                   <div className="text-gray-600 dark:text-gray-300">
                      {uiStore.themeMode === 'dark' ? <Moon size={14} /> : uiStore.themeMode === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                   </div>
                 </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                 <DropdownMenu.Content 
                   className="w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-in fade-in zoom-in-95 duration-100"
                   align="end"
                   sideOffset={5}
                 >
                   {/* Mode Selection */}
                   <div className="mb-4">
                     <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Mode</div>
                     <div className="flex bg-gray-100 dark:bg-gray-900 rounded-md p-1">
                       {[
                         { value: 'light', icon: Sun, label: 'Light' },
                         { value: 'dark', icon: Moon, label: 'Dark' },
                         { value: 'system', icon: Monitor, label: 'Auto' },
                       ].map((mode) => (
                          <button
                            key={mode.value}
                            onClick={() => uiStore.setThemeMode(mode.value as ThemeMode)}
                            className={cn(
                             "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm rounded-sm transition-all",
                             uiStore.themeMode === mode.value 
                               ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white font-medium" 
                               : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                           )}
                           title={mode.label}
                         >
                           <mode.icon size={14} />
                           <span className="text-xs">{mode.label}</span>
                         </button>
                       ))}
                     </div>
                   </div>

                   <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />

                   {/* Color Selection */}
                   <div>
                     <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Accent Color</div>
                     <div className="grid grid-cols-6 gap-2">
                       {THEME_COLORS.map((color) => (
                         <button
                           key={color.value}
                           onClick={() => uiStore.setThemeColor(color.value)}
                           className={cn(
                             "w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800",
                             uiStore.themeColor === color.value && "ring-2 ring-offset-2 dark:ring-offset-gray-800 scale-110"
                           )}
                           style={{ backgroundColor: color.value, borderColor: uiStore.themeColor === color.value ? color.value : undefined }}
                           title={color.name}
                         />
                       ))}
                     </div>
                   </div>

                   <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />

                   {/* Markdown Theme Selection */}
                   <div>
                     <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Layout Style</div>
                     <div className="space-y-1">
                       {[
                         { value: 'default', label: 'Default (Minimal)' },
                         { value: 'classic', label: 'Classic (Border)' },
                         { value: 'bubble', label: 'Bubble (Card)' },
                         { value: 'ribbon', label: 'Ribbon (Solid)' },
                         { value: 'tech', label: 'Tech (Counter)' },
                         { value: 'elegant', label: 'Elegant (Serif)' },
                       ].map((theme) => (
                         <button
                           key={theme.value}
                           onClick={() => uiStore.setMarkdownTheme(theme.value)}
                           className={cn(
                             "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                             uiStore.markdownTheme === theme.value 
                               ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium" 
                               : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                           )}
                         >
                           <div className="flex items-center justify-between">
                             <span>{theme.label}</span>
                             {uiStore.markdownTheme === theme.value && <Check size={14} className="text-primary" />}
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>
                 </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
         </div>
      </div>
    </>
  );
});
