import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';
import type { ToastStore } from './ToastStore';
import type { GitStore } from './GitStore';

interface SearchResult {
  path: string;
  name: string;
  matches: string[];
}

// Tab interface
interface OpenTab {
  file: FileNode;
  content: string;
  originalContent: string;
  isModified: boolean;
}

// Export progress item interface
export interface ExportProgressItem {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export class FileStore {
  fileTree: FileNode[] = [];
  currentFile: FileNode | null = null;
  currentContent: string = '';
  originalContent: string = ''; // Track original content to determine dirty state
  rootPath: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  isAutoSaving: boolean = false;
  unsavedFilePaths: Set<string> = new Set(); // Track files with unsaved changes
  searchQuery: string = '';
  searchResults: SearchResult[] = []; // Content search results
  isSearching: boolean = false; // Searching state

  // Tab management
  openTabs: OpenTab[] = [];
  activeTabId: string | null = null;
  maxTabs: number = 10; // Maximum number of open tabs (set to 10 instead of 5 for better usability)

  // Export progress dialog state
  exportDialog: {
    isOpen: boolean;
    title: string;
    currentFile?: string;
    totalProgress: number;
    items: ExportProgressItem[];
    status: 'exporting' | 'completed' | 'error';
    completedCount: number;
    totalCount: number;
  } = {
    isOpen: false,
    title: '导出',
    totalProgress: 0,
    items: [],
    status: 'exporting',
    completedCount: 0,
    totalCount: 0
  };

  public toastStore: ToastStore;
  private gitStore?: GitStore;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null; // Debounce timer
  private tabContents: Map<string, { content: string; originalContent: string }> = new Map(); // Store tab contents

  constructor(toastStore: ToastStore, gitStore?: GitStore) {
    makeAutoObservable(this);
    this.toastStore = toastStore;
    this.gitStore = gitStore;
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;

    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Clear results if query is empty
    if (!query.trim()) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    // Debounce search (500ms)
    this.isSearching = true;
    this.searchTimeout = setTimeout(() => {
      this.performContentSearch(query);
    }, 500);
  }

  async performContentSearch(query: string) {
    if (!query.trim()) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    try {
      const res = await window.electronAPI.searchContent(query);
      if (res.success && res.data) {
        runInAction(() => {
          this.searchResults = res.data!;
          this.isSearching = false;
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      runInAction(() => {
        this.searchResults = [];
        this.isSearching = false;
      });
    }
  }

  get projectName(): string {
    if (!this.rootPath) return '';
    // Handle both / and \ separators just in case, though usually one prevails in a given OS
    const separator = this.rootPath.includes('/') ? '/' : '\\';
    const parts = this.rootPath.split(separator).filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  get filteredFiles(): FileNode[] {
    if (!this.searchQuery) return this.fileTree;

    const lowerQuery = this.searchQuery.toLowerCase();

    // Fuzzy match function
    const fuzzyMatch = (text: string, query: string): boolean => {
      const textLower = text.toLowerCase();
      let queryIndex = 0;
      let textIndex = 0;

      while (queryIndex < query.length && textIndex < textLower.length) {
        if (query[queryIndex] === textLower[textIndex]) {
          queryIndex++;
        }
        textIndex++;
      }

      return queryIndex === query.length;
    };

    // Check if file content matches (async, but we can't use async in getter)
    // For now, just search by name with fuzzy matching
    const filterNode = (node: FileNode): FileNode | null => {
      // Try exact match first, then fuzzy match
      const nameMatch = node.name.toLowerCase().includes(lowerQuery) ||
                       fuzzyMatch(node.name, this.searchQuery);

      if (nameMatch) {
        return node;
      }

      // If node is directory, check children
      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is FileNode => n !== null);

        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }

      return null;
    };

    return this.fileTree
      .map(filterNode)
      .filter((n): n is FileNode => n !== null);
  }

  async loadFileTree() {
    this.isLoading = true;
    try {
      const [treeRes, configRes] = await Promise.all([
        window.electronAPI.getFileTree(),
        window.electronAPI.getConfig()
      ]);
      
      runInAction(() => {
        if (treeRes.success && treeRes.data) {
          this.fileTree = treeRes.data!;
        }
        if (configRes.success && configRes.data) {
          this.rootPath = configRes.data!.repoPath;
        }
      });
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async selectFile(node: FileNode) {
    if (node.type !== 'file') return;

    // Check if file is already open in tabs
    const existingTab = this.openTabs.find(tab => tab.file.path === node.path);

    if (existingTab) {
      // Just switch to the existing tab
      this.activeTabId = existingTab.file.id;
      this.currentFile = existingTab.file;
      this.currentContent = existingTab.content;
      this.originalContent = existingTab.originalContent;
      return;
    }

    // Check if we've reached max tabs
    if (this.openTabs.length >= this.maxTabs) {
      this.toastStore.error(`最多只能打开 ${this.maxTabs} 个标签页，请先关闭一些标签。`);
      return;
    }

    // Auto-save current file if it has unsaved changes
    if (this.currentFile && this.unsavedFilePaths.has(this.currentFile.path)) {
      this.saveCurrentFile()
        .catch(error => {
          console.error('Auto-save failed:', error);
          this.toastStore.error('自动保存失败，请检查文件权限。');
        });
    }

    // Save current tab content before switching
    if (this.currentFile && this.activeTabId) {
      this.updateTabContent(this.activeTabId, this.currentContent, this.originalContent);
    }

    // Load new file
    this.isLoading = true;
    try {
      const res = await window.electronAPI.readFile(node.path);
      if (res.success) {
        const content = res.data || '';
        runInAction(() => {
          // Add new tab
          this.openTabs.push({
            file: node,
            content: content,
            originalContent: content,
            isModified: false
          });

          // Set as active
          this.activeTabId = node.id;
          this.currentFile = node;
          this.currentContent = content;
          this.originalContent = content;

          // Store content in map
          this.tabContents.set(node.id, { content, originalContent: content });
        });
      }
    } catch (error) {
      console.error('Failed to read file:', error);
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  private updateTabContent(tabId: string, content: string, originalContent: string) {
    const tab = this.openTabs.find(t => t.file.id === tabId);
    if (tab) {
      tab.content = content;
      tab.originalContent = originalContent;
      tab.isModified = content !== originalContent;
    }
  }

  switchTab(tabId: string) {
    const tab = this.openTabs.find(t => t.file.id === tabId);
    if (!tab) return;

    // Save current tab content before switching
    if (this.currentFile && this.activeTabId && this.activeTabId !== tabId) {
      this.updateTabContent(this.activeTabId, this.currentContent, this.originalContent);
    }

    this.activeTabId = tabId;
    this.currentFile = tab.file;
    this.currentContent = tab.content;
    this.originalContent = tab.originalContent;
  }

  closeTab(tabId: string) {
    const tabIndex = this.openTabs.findIndex(t => t.file.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.openTabs[tabIndex];

    // Check if tab has unsaved changes
    if (tab.isModified || this.unsavedFilePaths.has(tab.file.path)) {
      const confirmClose = confirm(`${tab.file.name} 有未保存的更改，确定要关闭吗？`);
      if (!confirmClose) return;
    }

    runInAction(() => {
      // Remove tab
      this.openTabs.splice(tabIndex, 1);
      this.tabContents.delete(tabId);

      // If closing the active tab, switch to another
      if (this.activeTabId === tabId) {
        if (this.openTabs.length > 0) {
          // Switch to the right tab, or the left tab if closing the last one
          const newIndex = Math.min(tabIndex, this.openTabs.length - 1);
          const newTab = this.openTabs[newIndex];
          this.activeTabId = newTab.file.id;
          this.currentFile = newTab.file;
          this.currentContent = newTab.content;
          this.originalContent = newTab.originalContent;
        } else {
          // No more tabs
          this.activeTabId = null;
          this.currentFile = null;
          this.currentContent = '';
          this.originalContent = '';
        }
      }
    });
  }

  updateContent(content: string) {
    this.currentContent = content;

    // Update tab content
    if (this.activeTabId) {
      this.updateTabContent(this.activeTabId, content, this.originalContent);
    }

    if (this.currentFile) {
      if (content !== this.originalContent) {
        this.unsavedFilePaths.add(this.currentFile.path);
      } else {
        this.unsavedFilePaths.delete(this.currentFile.path);
      }
    }
  }

  async saveCurrentFile() {
    if (!this.currentFile) return;

    this.isSaving = true;
    try {
      await window.electronAPI.saveFile(this.currentFile.path, this.currentContent);

      // Auto-add to git after save
      await window.electronAPI.addGit(this.currentFile.path);

      runInAction(() => {
        this.originalContent = this.currentContent; // Update original content after save
        this.unsavedFilePaths.delete(this.currentFile!.path);

        // Update tab state
        if (this.activeTabId) {
          const tab = this.openTabs.find(t => t.file.id === this.activeTabId);
          if (tab) {
            tab.originalContent = this.currentContent;
            tab.isModified = false;
          }
        }
      });

      // Trigger immediate git status update for better UX
      if (this.gitStore) {
        this.gitStore.checkStatus();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  async createFile(parentPath: string, name: string) {
    try {
      const res = await window.electronAPI.createFile(parentPath, name);
      if (res.success) {
        // Optimistically add to file tree
        if (res.data) {
          this.insertNode(this.fileTree, parentPath, res.data);
          // Select the new file
          await this.selectFile(res.data);
        }
      } else {
        this.toastStore.error(res.error || '创建文件失败');
        // Fallback to full reload on error
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      this.toastStore.error('创建文件失败');
      await this.loadFileTree();
    }
  }

  async createDir(parentPath: string, name: string) {
    try {
      const res = await window.electronAPI.createDir(parentPath, name);
      if (res.success) {
        // Optimistically add to file tree
        if (res.data) {
          this.insertNode(this.fileTree, parentPath, res.data);
        }
      } else {
        this.toastStore.error(res.error || '创建文件夹失败');
        // Fallback to full reload on error
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to create directory:', error);
      this.toastStore.error('创建文件夹失败');
      await this.loadFileTree();
    }
  }

  async deleteItem(path: string) {
    try {
      const res = await window.electronAPI.deleteItem(path);
      if (res.success) {
        if (this.currentFile?.path === path) {
          this.currentFile = null;
          this.currentContent = '';
        }
        // Optimistically remove from file tree
        this.removeNode(this.fileTree, path);
      } else {
        this.toastStore.error(res.error || '删除失败');
        // Fallback to full reload on error
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      this.toastStore.error('删除失败');
      await this.loadFileTree();
    }
  }

  async renameItem(oldPath: string, newName: string) {
    try {
      const res = await window.electronAPI.renameItem(oldPath, newName);
      if (res.success && res.data) {
        const newPath = res.data;
        const isCurrentFile = this.currentFile?.path === oldPath;

        // Reload the file tree to reflect the change
        await this.loadFileTree();

        // If we renamed the current file, re-select it with the new path
        if (isCurrentFile) {
          // Find the file node with the new path
          const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
            for (const node of nodes) {
              if (node.path === targetPath) return node;
              if (node.children) {
                const found = findNode(node.children, targetPath);
                if (found) return found;
              }
            }
            return null;
          };

          const newNode = findNode(this.fileTree, newPath);
          if (newNode && newNode.type === 'file') {
            await this.selectFile(newNode);
          }
        }
      } else {
        this.toastStore.error(res.error || '重命名失败');
      }
    } catch (error) {
      console.error('Failed to rename item:', error);
      this.toastStore.error('重命名失败');
    }
  }

  // Drag and Drop Move
  async moveItem(sourcePath: string, targetParentPath: string) {
    try {
      const res = await window.electronAPI.moveItem(sourcePath, targetParentPath);
      if (res.success && res.data) {
        const newPath = res.data;
        const isCurrentFile = this.currentFile?.path === sourcePath;

        // Reload the file tree to reflect the change
        await this.loadFileTree();

        // If we moved the current file, re-select it with the new path
        if (isCurrentFile) {
          // Find the file node with the new path
          const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
            for (const node of nodes) {
              if (node.path === targetPath) return node;
              if (node.children) {
                const found = findNode(node.children, targetPath);
                if (found) return found;
              }
            }
            return null;
          };

          const newNode = findNode(this.fileTree, newPath);
          if (newNode && newNode.type === 'file') {
            await this.selectFile(newNode);
          }
        }
      } else {
        this.toastStore.error(res.error || '移动失败');
      }
    } catch (error) {
      console.error('Failed to move item:', error);
      this.toastStore.error('移动失败');
    }
  }

  // Helper methods for incremental file tree updates
  private insertNode(nodes: FileNode[], parentPath: string, newNode: FileNode): boolean {
    for (const node of nodes) {
      if (node.path === parentPath && node.type === 'directory') {
        // Found the parent directory
        if (!node.children) node.children = [];
        // Insert and sort (directories first, then alphabetically)
        node.children.push(newNode);
        node.children.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });
        return true;
      }
      if (node.children && this.insertNode(node.children, parentPath, newNode)) {
        return true;
      }
    }
    return false;
  }

  private removeNode(nodes: FileNode[], targetPath: string): boolean {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].path === targetPath) {
        nodes.splice(i, 1);
        return true;
      }
      if (nodes[i].children && this.removeNode(nodes[i].children!, targetPath)) {
        return true;
      }
    }
    return false;
  }

  // Collect all markdown files in a directory recursively
  private collectMarkdownFiles(node: FileNode, files: FileNode[] = []): FileNode[] {
    if (node.type === 'file' && node.name.endsWith('.md')) {
      files.push(node);
    } else if (node.type === 'directory' && node.children) {
      for (const child of node.children) {
        this.collectMarkdownFiles(child, files);
      }
    }
    return files;
  }

  // Export single note as Markdown
  async exportAsMarkdown(filePath: string, defaultName?: string) {
    try {
      const res = await window.electronAPI.readFile(filePath);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to read file');
      }

      const content = res.data;
      const fileName = defaultName || filePath.split('/').pop() || 'note.md';

      // Use exportHtml to save markdown (it's just a file save with dialog)
      // We'll pass the markdown content and let the user choose where to save
      // Since exportHtml expects HTML, we need to work around this
      // For now, let's use a different approach: save to a temporary location and let user move it

      // Better approach: Ask user to select a directory, then save the file there
      const dirRes = await window.electronAPI.openDirectory();
      if (!dirRes.success || !dirRes.data || dirRes.data.canceled) {
        return { success: false, error: 'Canceled' };
      }

      const exportPath = `${dirRes.data.filePaths[0]}/${fileName}`;
      await window.electronAPI.saveFile(exportPath, content);

      this.toastStore.success(`成功导出到 ${exportPath}`);
      return { success: true, data: exportPath };
    } catch (error) {
      console.error('Export as markdown failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  }

  // Export single note as HTML (with rendered styles)
  async exportAsHtml(filePath: string, content: string, defaultName?: string) {
    try {
      const fileName = defaultName || filePath.split('/').pop()?.replace('.md', '.html') || 'note.html';

      const res = await window.electronAPI.exportHtml(content, fileName);
      return res;
    } catch (error) {
      console.error('Export as HTML failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  }

  // Export single note as PDF (with rendered styles)
  async exportAsPdf(filePath: string, htmlContent: string, defaultName?: string) {
    try {
      const fileName = defaultName || filePath.split('/').pop()?.replace('.md', '.pdf') || 'note.pdf';

      const res = await window.electronAPI.exportPdf(htmlContent, fileName);
      return res;
    } catch (error) {
      console.error('Export as PDF failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  }

  // Batch export notes from a directory
  async batchExportNotes(
    directoryPath: string,
    format: 'md' | 'html' | 'pdf'
  ) {
    try {
      // Find the directory node
      const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
        for (const node of nodes) {
          if (node.path === targetPath) return node;
          if (node.children) {
            const found = findNode(node.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      };

      const dirNode = findNode(this.fileTree, directoryPath);
      if (!dirNode) {
        this.toastStore?.error('未找到该文件夹');
        return { success: false, error: 'Directory not found' };
      }

      // Collect all markdown files
      const files = this.collectMarkdownFiles(dirNode);
      console.log('Found files to export:', files.length, files.map(f => f.name));

      if (files.length === 0) {
        this.toastStore?.warning('该文件夹中没有Markdown文件');
        return { success: false, error: 'No markdown files found in directory' };
      }

      // Ask user where to save
      const saveRes = await window.electronAPI.openDirectory();
      console.log('Directory selection result:', saveRes);

      if (!saveRes.success || !saveRes.data || saveRes.data.canceled) {
        console.log('Directory selection was canceled or failed');
        return { success: false, error: 'Canceled' };
      }

      const exportDir = saveRes.data.filePaths[0];
      console.log('Export directory:', exportDir);
      const results: { success: boolean; path?: string; error?: string }[] = [];

      // Initialize export dialog
      const formatName = format === 'md' ? 'Markdown' : format === 'html' ? 'HTML' : 'PDF';
      runInAction(() => {
        this.exportDialog = {
          isOpen: true,
          title: `批量导出 ${formatName}`,
          totalProgress: 0,
          items: files.map(f => ({
            fileName: f.name,
            status: 'pending' as const
          })),
          status: 'exporting' as const,
          completedCount: 0,
          totalCount: files.length
        };
      });

      // Import marked for HTML/PDF conversion
      const { marked } = await import('marked');
      marked.use({ breaks: true, gfm: true });

      // Helper function to create custom renderer for each file
      const createRenderer = (filePath: string) => {
        const renderer = new marked.Renderer();

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
            // Get the directory of the current file
            const lastSlashIndex = filePath.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
              const currentDir = filePath.substring(0, lastSlashIndex);
              // Construct absolute path
              const absolutePath = `${currentDir}/${href}`;
              // Use media://local protocol
              src = `media://local${absolutePath}`;
            }
          }

          return `<img src="${src}" alt="${text}" title="${title || ''}" style="${style}" />`;
        };

        return renderer;
      };

      let successCount = 0;
      let failCount = 0;
      let currentIndex = 0;

      for (const file of files) {
        currentIndex++;
        const fileIndex = currentIndex - 1;

        // Update progress - mark current file as processing
        runInAction(() => {
          this.exportDialog.items[fileIndex].status = 'processing';
          this.exportDialog.items[fileIndex].fileName = file.name;
          this.exportDialog.currentFile = file.name;
          this.exportDialog.completedCount = currentIndex - 1;
          this.exportDialog.totalProgress = ((currentIndex - 1) / files.length) * 100;
        });

        try {
          const fileRes = await window.electronAPI.readFile(file.path);
          if (!fileRes.success || !fileRes.data) {
            console.error('Failed to read file:', file.name, fileRes.error);
            failCount++;
            runInAction(() => {
              this.exportDialog.items[fileIndex].status = 'error';
              this.exportDialog.items[fileIndex].error = fileRes.error;
            });
            results.push({ success: false, error: fileRes.error });
            continue;
          }

          const content = fileRes.data;
          let fileName = file.name;

          if (format === 'md') {
            fileName = file.name;
            const exportPath = `${exportDir}/${fileName}`;
            console.log(`Exporting MD: ${file.name} -> ${exportPath}`);

            // Use direct write API to bypass path validation
            const saveRes = await window.electronAPI.saveFileDirect(exportPath, content);
            console.log('MD export result:', file.name, saveRes);

            if (saveRes.success) {
              successCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'success';
              });
              results.push({ success: true, path: exportPath });
            } else {
              console.error('Failed to export MD:', file.name, saveRes.error);
              failCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'error';
                this.exportDialog.items[fileIndex].error = saveRes.error;
              });
              results.push({ success: false, error: saveRes.error });
            }
          } else if (format === 'html') {
            fileName = file.name.replace('.md', '.html');
            // Use custom renderer to handle image paths
            const renderer = createRenderer(file.path);
            const htmlContent = await marked.parse(content, { renderer }) as string;
            const exportPath = `${exportDir}/${fileName}`;
            console.log(`Exporting HTML: ${file.name} -> ${exportPath}`);

            // Create complete HTML document
            const completeHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${file.name.replace('.md', '')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        pre {
            background: #f6f8fa;
            padding: 16px;
            overflow: auto;
            border-radius: 6px;
        }
        code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 85%;
        }
        blockquote {
            border-left: 4px solid #ddd;
            padding-left: 16px;
            color: #666;
            margin: 16px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        table th, table td {
            border: 1px solid #ddd;
            padding: 8px 12px;
        }
        table th {
            background: #f6f8fa;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        a {
            color: #0969da;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .mermaid {
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

            // Use direct export API (no dialog)
            const res = await window.electronAPI.exportHtmlDirect(completeHtml, exportPath);
            console.log('HTML export result:', file.name, res);
            if (res.success) {
              successCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'success';
              });
              results.push({ success: true, path: res.data });
            } else {
              console.error('Failed to export HTML:', file.name, res.error);
              failCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'error';
                this.exportDialog.items[fileIndex].error = res.error;
              });
              results.push({ success: false, error: res.error });
            }
          } else if (format === 'pdf') {
            fileName = file.name.replace('.md', '.pdf');
            // Use custom renderer to handle image paths
            const renderer = createRenderer(file.path);
            const htmlContent = await marked.parse(content, { renderer }) as string;
            const exportPath = `${exportDir}/${fileName}`;
            console.log(`Exporting PDF: ${file.name} -> ${exportPath}`);

            // Use direct export API (no dialog)
            const res = await window.electronAPI.exportPdfDirect(htmlContent, exportPath);
            console.log('PDF export result:', file.name, res);
            if (res.success) {
              successCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'success';
              });
              results.push({ success: true, path: res.data });
            } else {
              console.error('Failed to export PDF:', file.name, res.error);
              failCount++;
              runInAction(() => {
                this.exportDialog.items[fileIndex].status = 'error';
                this.exportDialog.items[fileIndex].error = res.error;
              });
              results.push({ success: false, error: res.error });
            }
          }
        } catch (error) {
          console.error('Export error for file:', file.name, error);
          failCount++;
          runInAction(() => {
            this.exportDialog.items[fileIndex].status = 'error';
            this.exportDialog.items[fileIndex].error = error instanceof Error ? error.message : 'Export failed';
          });
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Export failed'
          });
        }
      }

      console.log('Export complete:', { successCount, failCount, total: files.length });
      console.log('Export results:', results);

      // Update dialog to completed state
      runInAction(() => {
        this.exportDialog.status = failCount > 0 && successCount === 0 ? 'error' : 'completed';
        this.exportDialog.completedCount = files.length;
        this.exportDialog.totalProgress = 100;
      });

      // Show appropriate message with export directory info
      if (successCount === files.length) {
        this.toastStore.success(`已导出全部 ${files.length} 个文件到 ${exportDir}`);
      } else if (successCount > 0) {
        this.toastStore.warning(`部分导出成功：${successCount}/${files.length}`);
      } else {
        this.toastStore.error('导出失败，请检查文件权限');
      }

      return { success: true, data: results };
    } catch (error) {
      console.error('Batch export failed:', error);
      runInAction(() => {
        this.exportDialog.status = 'error';
      });
      this.toastStore?.error('批量导出失败');
      return { success: false, error: error instanceof Error ? error.message : 'Batch export failed' };
    }
  }

  // Close export dialog
  closeExportDialog() {
    runInAction(() => {
      this.exportDialog.isOpen = false;
    });
  }
}
