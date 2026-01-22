import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Download, FileText, File, FileImage } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { marked, Renderer } from 'marked';
import { ExportProgressDialog, useExportProgressDialog } from '../ExportProgressDialog';

// Configure marked
marked.use({
  breaks: true,
  gfm: true,
});

export const ExportButton = observer(() => {
  const { fileStore } = useStore();
  const [isExporting, setIsExporting] = useState(false);
  const exportDialog = useExportProgressDialog();

  const getRenderedHtml = async (markdown: string): Promise<string> => {
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

    return await marked.parse(markdown, { renderer }) as string;
  };

  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || '文件';
  };

  const checkCurrentFile = () => {
    if (!fileStore.currentFile) {
      fileStore.toastStore?.warning('请先打开要导出的笔记');
      return false;
    }
    return true;
  };

  const handleExportMarkdown = async () => {
    if (!checkCurrentFile()) return;

    setIsExporting(true);
    try {
      const fileName = fileStore.currentFile!.name;
      const dirRes = await window.electronAPI.openDirectory();

      if (!dirRes.success || !dirRes.data || dirRes.data.canceled) {
        return;
      }

      const exportPath = `${dirRes.data.filePaths[0]}/${fileName}`;
      await window.electronAPI.saveFile(exportPath, fileStore.currentContent);
      fileStore.toastStore?.success(`已导出 ${getFileName(fileName)}`);
    } catch (error) {
      console.error('Export markdown failed:', error);
      fileStore.toastStore?.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHtml = async () => {
    if (!checkCurrentFile()) return;

    setIsExporting(true);
    try {
      const fileName = fileStore.currentFile!.name.replace('.md', '.html');
      const html = await getRenderedHtml(fileStore.currentContent);

      // Show progress dialog
      exportDialog.open('导出 HTML', 1);
      exportDialog.updateProgress(0, 1, fileName);

      const res = await window.electronAPI.exportHtml(html, fileName);

      if (res.success) {
        exportDialog.updateProgress(1, 1, fileName);
        exportDialog.complete(true);
        fileStore.toastStore?.success(`已导出 ${getFileName(fileName)}`);
      } else if (res.error !== 'Canceled') {
        exportDialog.complete(false);
        fileStore.toastStore?.error('导出失败，请重试');
      } else {
        exportDialog.close();
      }
    } catch (error) {
      console.error('Export HTML failed:', error);
      exportDialog.complete(false);
      fileStore.toastStore?.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!checkCurrentFile()) return;

    setIsExporting(true);
    try {
      const fileName = fileStore.currentFile!.name.replace('.md', '.pdf');
      const html = await getRenderedHtml(fileStore.currentContent);

      // Show progress dialog
      exportDialog.open('导出 PDF', 1);
      exportDialog.updateProgress(0, 1, fileName);

      const res = await window.electronAPI.exportPdf(html, fileName);

      if (res.success) {
        exportDialog.updateProgress(1, 1, fileName);
        exportDialog.complete(true);
        fileStore.toastStore?.success(`已导出 ${getFileName(fileName)}`);
      } else if (res.error !== 'Canceled') {
        exportDialog.complete(false);
        fileStore.toastStore?.error('导出失败，请重试');
      } else {
        exportDialog.close();
      }
    } catch (error) {
      console.error('Export PDF failed:', error);
      exportDialog.complete(false);
      fileStore.toastStore?.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="导出"
            disabled={isExporting}
          >
            <Download size={16} className={isExporting ? 'animate-pulse' : ''} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[160px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
              onSelect={handleExportMarkdown}
              disabled={isExporting}
            >
              <FileText size={14} className="mr-2" />
              导出为 Markdown
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
              onSelect={handleExportHtml}
              disabled={isExporting}
            >
              <File size={14} className="mr-2" />
              导出为 HTML
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
              onSelect={handleExportPdf}
              disabled={isExporting}
            >
              <FileImage size={14} className="mr-2" />
              导出为 PDF
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ExportProgressDialog
        isOpen={exportDialog.dialogState.isOpen}
        title={exportDialog.dialogState.title}
        currentFile={exportDialog.dialogState.currentFile}
        totalProgress={exportDialog.dialogState.totalProgress}
        items={exportDialog.dialogState.items}
        status={exportDialog.dialogState.status}
        completedCount={exportDialog.dialogState.completedCount}
        totalCount={exportDialog.dialogState.totalCount}
        onClose={exportDialog.close}
      />
    </>
  );
});
