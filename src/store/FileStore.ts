import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';
import type { ToastStore } from './ToastStore';
import type { GitStore } from './GitStore';
import { TabStore, type OpenTab } from './TabStore';
import { SearchStore, type SearchResult } from './SearchStore';
import { ExportStore, type ExportFormat } from './ExportStore';
import { FavoriteStore } from './FavoriteStore';

const SORT_SETTINGS_STORAGE_KEY = 'zhixia-sort-settings';

/**
 * FileStore - Core file management store
 * Handles file tree, current file state, and file operations
 * Delegates tabs, search, export, and favorites to specialized sub-stores
 */
export class FileStore {
  // File tree and current file state
  fileTree: FileNode[] = [];
  currentFile: FileNode | null = null;
  currentContent: string = '';
  originalContent: string = '';
  rootPath: string = '';

  // Loading and saving states
  isLoading: boolean = false;
  isSaving: boolean = false;
  isAutoSaving: boolean = false;
  unsavedFilePaths: Set<string> = new Set();

  // Expansion state for sidebar folders - using object for HMR compatibility
  expandedPaths: Record<string, boolean> = {};

  // Sort settings - map directory path to sort order
  sortSettings: Map<string, 'asc' | 'desc'> = new Map();

  // Sub-stores for specialized functionality
  readonly tabStore: TabStore;
  readonly searchStore: SearchStore;
  readonly exportStore: ExportStore;
  readonly favoriteStore: FavoriteStore;

  public toastStore: ToastStore;
  private gitStore?: GitStore;
  public tagStore?: any; // TagStore injected after creation
  public trashStore?: any; // TrashStore injected after creation

  constructor(toastStore: ToastStore, gitStore?: GitStore) {
    makeAutoObservable(this, {
      // Sub-stores are already observable
      tabStore: false,
      searchStore: false,
      exportStore: false,
      favoriteStore: false,
      // expandedPaths is an ObservableSet, no need for observable.ref
    });

    this.toastStore = toastStore;
    this.gitStore = gitStore;

    // Initialize sub-stores
    this.tabStore = new TabStore();
    this.searchStore = new SearchStore();
    this.exportStore = new ExportStore();
    this.favoriteStore = new FavoriteStore();

    this.loadSortSettings();
  }

  // Toggle expansion state of a directory
  toggleExpand(path: string) {
    if (this.expandedPaths[path]) {
      delete this.expandedPaths[path];
    } else {
      this.expandedPaths[path] = true;
    }
  }

  // Set expansion state explicitly
  setExpanded(path: string, expanded: boolean) {
    if (expanded) {
      this.expandedPaths[path] = true;
    } else {
      delete this.expandedPaths[path];
    }
  }

  // Check if a path is expanded
  isExpanded(path: string): boolean {
    return !!this.expandedPaths[path];
  }

  expandAll() {
    runInAction(() => {
      const newPaths: Record<string, boolean> = {};
      const collectPaths = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          if (node.type === 'directory') {
            newPaths[node.path] = true;
            if (node.children) {
              collectPaths(node.children);
            }
          }
        });
      };
      collectPaths(this.fileTree);
      this.expandedPaths = newPaths;
    });
  }

  collapseAll() {
    runInAction(() => {
      this.expandedPaths = {};
    });
  }

  expandToLevel(targetLevel: number) {
    runInAction(() => {
      const newPaths: Record<string, boolean> = {};
      const collectPaths = (nodes: FileNode[], currentLevel: number) => {
        nodes.forEach(node => {
          if (node.type === 'directory' && currentLevel <= targetLevel) {
            newPaths[node.path] = true;
            if (node.children) {
              collectPaths(node.children, currentLevel + 1);
            }
          }
        });
      };
      collectPaths(this.fileTree, 0);
      this.expandedPaths = newPaths;
    });
  }

  // Computed: Project name from root path
  get projectName(): string {
    if (!this.rootPath) return '';
    const separator = this.rootPath.includes('/') ? '/' : '\\';
    const parts = this.rootPath.split(separator).filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  // Computed: Filtered files based on search query and tag selection
  get filteredFiles(): FileNode[] {
    const query = this.searchStore.searchQuery;
    const selectedTag = this.tagStore?.selectedTag;

    // If no filters, return full tree
    if (!query && !selectedTag) return this.fileTree;

    const lowerQuery = query?.toLowerCase() || '';

    const fuzzyMatch = (text: string, queryStr: string): boolean => {
      const textLower = text.toLowerCase();
      let queryIndex = 0;
      let textIndex = 0;

      while (queryIndex < queryStr.length && textIndex < textLower.length) {
        if (queryStr[queryIndex] === textLower[textIndex]) {
          queryIndex++;
        }
        textIndex++;
      }

      return queryIndex === queryStr.length;
    };

    // Collect all file paths with the selected tag
    const taggedFilePaths = selectedTag
      ? new Set(this.tagStore?.getFilesWithTag(selectedTag) || [])
      : null;

    const filterNode = (node: FileNode): FileNode | null => {
      // For files, check both query and tag filters
      if (node.type === 'file') {
        const nameMatch = !query ||
          node.name.toLowerCase().includes(lowerQuery) ||
          fuzzyMatch(node.name, query);

        const tagMatch = !selectedTag ||
          (taggedFilePaths && taggedFilePaths.has(node.path));

        if (nameMatch && tagMatch) {
          return node;
        }
        return null;
      }

      // For directories, check children
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

  // Convenience getters for sub-store properties
  get openTabs(): OpenTab[] {
    return this.tabStore.getAllTabs();
  }

  get activeTabId(): string | null {
    return this.tabStore.getActiveTab()?.file.id || null;
  }

  get searchQuery(): string {
    return this.searchStore.searchQuery;
  }

  get searchResults(): SearchResult[] {
    return this.searchStore.searchResults;
  }

  get isSearching(): boolean {
    return this.searchStore.isSearching;
  }

  get favorites(): string[] {
    return this.favoriteStore.getAllFavorites();
  }

  get exportDialog() {
    return this.exportStore.exportDialog;
  }

  // Search methods
  setSearchQuery(query: string) {
    this.searchStore.setSearchQuery(query);
    // Trigger actual search when debounce is ready
    if (!query.trim()) return;

    // Small delay to let debounce happen, then perform search
    setTimeout(() => {
      if (this.searchStore.searchQuery === query) {
        this.performContentSearch(query);
      }
    }, 350);
  }

  private async performContentSearch(query: string) {
    if (!query.trim()) return;

    try {
      const res = await window.electronAPI.searchContent(query);
      if (res.success && res.data) {
        this.searchStore.setSearchResults(res.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
      this.searchStore.setSearchResults([]);
    }
  }

  // Load file tree from backend
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

  // Select and open a file
  async selectFile(node: FileNode) {
    if (node.type !== 'file') return;

    // Check if file is already open
    const existingTab = this.tabStore.findTabByPath(node.path);
    if (existingTab) {
      // Save current tab content first
      if (this.currentFile && this.activeTabId) {
        this.tabStore.updateTabContent(this.activeTabId, this.currentContent, this.originalContent);
      }

      // Switch to existing tab
      this.tabStore.switchTab(existingTab.file.id);
      const tab = this.tabStore.getActiveTab();
      if (tab) {
        this.currentFile = tab.file;
        this.currentContent = tab.content;
        this.originalContent = tab.originalContent;
      }
      return;
    }

    // Check if we can open more tabs
    if (!this.tabStore.canOpenTab()) {
      this.toastStore.error(`最多只能打开 ${this.tabStore.maxTabs} 个标签页`);
      return;
    }

    // Auto-save current file if needed
    if (this.currentFile && this.unsavedFilePaths.has(this.currentFile.path)) {
      await this.saveCurrentFile().catch(error => {
        console.error('Auto-save failed:', error);
        this.toastStore.error('自动保存失败');
      });
    }

    // Save current tab content
    if (this.currentFile && this.activeTabId) {
      this.tabStore.updateTabContent(this.activeTabId, this.currentContent, this.originalContent);
    }

    // Load new file
    this.isLoading = true;
    try {
      const res = await window.electronAPI.readFile(node.path);
      if (res.success) {
        const content = res.data || '';
        runInAction(() => {
          this.tabStore.addTab({
            file: node,
            content,
            originalContent: content,
            isModified: false
          });

          this.currentFile = node;
          this.currentContent = content;
          this.originalContent = content;
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

  // Switch to a different tab
  switchTab(tabId: string) {
    const tab = this.tabStore.findTabById(tabId);
    if (!tab) return;

    // Save current tab content first
    if (this.currentFile && this.activeTabId && this.activeTabId !== tabId) {
      this.tabStore.updateTabContent(this.activeTabId, this.currentContent, this.originalContent);
    }

    this.tabStore.switchTab(tabId);
    this.currentFile = tab.file;
    this.currentContent = tab.content;
    this.originalContent = tab.originalContent;
  }

  // Close a tab
  closeTab(tabId: string) {
    const tab = this.tabStore.findTabById(tabId);
    if (!tab) return;

    // Check for unsaved changes
    if (tab.isModified || this.unsavedFilePaths.has(tab.file.path)) {
      if (!confirm(`${tab.file.name} 有未保存的更改，确定要关闭吗？`)) {
        return;
      }
    }

    const closedTab = this.tabStore.closeTab(tabId);
    if (closedTab) {
      // Update current file based on new active tab
      const activeTab = this.tabStore.getActiveTab();
      if (activeTab) {
        this.currentFile = activeTab.file;
        this.currentContent = activeTab.content;
        this.originalContent = activeTab.originalContent;
      } else {
        this.currentFile = null;
        this.currentContent = '';
        this.originalContent = '';
      }
    }
  }

  // Update current content
  updateContent(content: string) {
    this.currentContent = content;

    if (this.activeTabId) {
      this.tabStore.updateTabContent(this.activeTabId, content, this.originalContent);
    }

    if (this.currentFile) {
      if (content !== this.originalContent) {
        this.unsavedFilePaths.add(this.currentFile.path);
      } else {
        this.unsavedFilePaths.delete(this.currentFile.path);
      }
    }
  }

  // Save current file
  async saveCurrentFile(updateMetadata = false) {
    if (!this.currentFile) return;

    this.isSaving = true;
    try {
      // 只在手动保存时更新文档元信息
      const contentToSave = updateMetadata
        ? this.updateDocumentMetadata(this.currentContent, this.currentFile.path)
        : this.currentContent;

      await window.electronAPI.saveFile(this.currentFile.path, contentToSave);
      await window.electronAPI.addGit(this.currentFile.path);

      runInAction(() => {
        this.originalContent = contentToSave;
        this.currentContent = contentToSave;
        this.unsavedFilePaths.delete(this.currentFile!.path);

        if (this.activeTabId) {
          this.tabStore.updateTabContent(this.activeTabId, contentToSave, contentToSave);
        }
      });

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

  // 更新文档元信息（创建时间、更新时间、笔记本）
  private updateDocumentMetadata(content: string, filePath: string): string {
    const now = new Date();
    const updateTime = this.formatDateTime(now);

    // 获取文件夹名称（笔记本名）
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '未分类';

    // 检查是否已有元信息 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      // 已有 frontmatter，重建为标准格式
      const createTimeMatch = frontmatterMatch[1].match(/创建时间:\s*(.+)/);
      const createTime = createTimeMatch ? createTimeMatch[1] : updateTime;

      // 构建新的 frontmatter，只包含这三个字段
      const newFrontmatter = `---\n创建时间: ${createTime}\n更新时间: ${updateTime}\n笔记本: ${folderName}\n---`;

      return content.replace(/^---\n[\s\S]*?\n---/, newFrontmatter);
    }

    // 没有 frontmatter，检查是否已有普通格式的元信息
    const hasCreateTime = /\*\*创建时间\*\*:\s*(.+)/.test(content);
    const hasUpdateTime = /\*\*更新时间\*\*:\s*(.+)/.test(content);
    const hasNotebook = /\*\*笔记本\*\*:\s*(.+)/.test(content);

    if (hasCreateTime || hasUpdateTime || hasNotebook) {
      // 将普通格式转换为 frontmatter 格式
      const createTimeMatch = content.match(/\*\*创建时间\*\*:\s*(.+)/);
      const createTime = createTimeMatch ? createTimeMatch[1] : updateTime;

      let contentWithoutMetadata = content;

      // 移除旧的元信息行
      contentWithoutMetadata = contentWithoutMetadata.replace(/\*\*创建时间\*\*:\s*.+\n?/g, '');
      contentWithoutMetadata = contentWithoutMetadata.replace(/\*\*更新时间\*\*:\s*.+\n?/g, '');
      contentWithoutMetadata = contentWithoutMetadata.replace(/\*\*笔记本\*\*:\s*.+\n?/g, '');

      // 添加 frontmatter 格式的元信息
      const titleMatch = contentWithoutMetadata.match(/^#\s+(.+)$/m);
      let title: string;
      let contentStart = contentWithoutMetadata.trimStart();

      if (titleMatch) {
        title = titleMatch[1].replace(/^\d+[\.\、]\s*/, '');
        contentStart = contentWithoutMetadata.replace(/^#\s+.+\n?/, '').trimStart();
      } else {
        title = fileName.replace('.md', '');
      }

      const frontmatter = `---\n创建时间: ${createTime}\n更新时间: ${updateTime}\n笔记本: ${folderName}\n---\n\n# ${title}\n\n`;

      return frontmatter + contentStart;
    }

    // 没有任何元信息，添加 frontmatter 格式
    const titleMatch = content.match(/^#\s+(.+)$/m);
    let title: string;
    let contentStart = content;

    if (titleMatch) {
      title = titleMatch[1].replace(/^\d+[\.\、]\s*/, '');
      contentStart = content.replace(/^#\s+.+\n?/, '');
    } else {
      title = fileName.replace('.md', '');
    }

    const frontmatter = `---\n创建时间: ${updateTime}\n更新时间: ${updateTime}\n笔记本: ${folderName}\n---\n\n# ${title}\n\n`;

    return frontmatter + contentStart.trimStart();
  }

  // 格式化日期时间
  private formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // Create a new file
  async createFile(parentPath: string, name: string) {
    // Preserve expansion state before async call (it may get lost during await)
    const savedExpandedPaths = { ...this.expandedPaths };

    try {
      const res = await window.electronAPI.createFile(parentPath, name);

      if (res.success) {
        if (res.data) {
          runInAction(() => {
            // Restore expansion state that may have been lost during await
            Object.assign(this.expandedPaths, savedExpandedPaths);

            this.insertNode(this.fileTree, parentPath, res.data!);
            // Ensure parent is expanded
            this.setExpanded(parentPath, true);
          });

          await this.selectFile(res.data);
        }
      } else {
        this.toastStore.error(res.error || '创建文件失败');
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      this.toastStore.error('创建文件失败');
      await this.loadFileTree();
    }
  }

  // Create a new directory
  async createDir(parentPath: string, name: string) {
    // Preserve expansion state
    const savedExpandedPaths = { ...this.expandedPaths };

    try {
      const res = await window.electronAPI.createDir(parentPath, name);

      runInAction(() => {
        // Restore expansion state
        Object.assign(this.expandedPaths, savedExpandedPaths);

        if (res.success) {
          if (res.data) {
            this.insertNode(this.fileTree, parentPath, res.data!);
            this.setExpanded(parentPath, true);
          }
        } else {
          this.toastStore.error(res.error || '创建文件夹失败');
        }
      });

      if (!res.success) {
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to create directory:', error);
      this.toastStore.error('创建文件夹失败');
      await this.loadFileTree();
    }
  }

  // Delete a file or directory
  // Move item to trash instead of permanent deletion
  async moveToTrash(path: string) {
    if (!this.trashStore || !this.rootPath) {
      return this.deleteItem(path); // Fallback to delete if trashStore not available
    }

    // Preserve expansion state before async operations
    const savedExpandedPaths = { ...this.expandedPaths };

    try {
      const node = this.findNode(this.fileTree, path);
      if (!node) {
        this.toastStore.error('文件不存在');
        return;
      }

      // Read file content before deleting
      const readFile = async (filePath: string): Promise<string> => {
        try {
          const result = await window.electronAPI.readFile(filePath);
          if (result.success && result.data) {
            return result.data;
          }
        } catch (e) {
          console.warn('Failed to read file for trash:', e);
        }
        return '';
      };

      // Add to trash store
      await this.trashStore.moveToTrash(this.rootPath, node, readFile, node.children);



      // Delete from file system
      const res = await window.electronAPI.deleteItem(path);

      runInAction(() => {
        // Restore expansion state (again, just in case)
        Object.assign(this.expandedPaths, savedExpandedPaths);

        if (res.success) {
          if (this.currentFile?.path === path) {
            this.currentFile = null;
            this.currentContent = '';
          }
          this.removeNode(this.fileTree, path);
          this.toastStore.success('已移至回收站');
        } else {
          this.toastStore.error(res.error || '删除失败');
        }
      });

      if (!res.success) {
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to move to trash:', error);
      this.toastStore.error('操作失败');
    }
  }

  // Permanently delete item (bypass trash)
  async deleteItem(path: string, _skipTrash: boolean = false) {
    // Preserve expansion state before async operations
    const savedExpandedPaths = { ...this.expandedPaths };

    try {
      const res = await window.electronAPI.deleteItem(path);

      runInAction(() => {
        // Restore expansion state
        Object.assign(this.expandedPaths, savedExpandedPaths);

        if (res.success) {
          if (this.currentFile?.path === path) {
            this.currentFile = null;
            this.currentContent = '';
          }
          this.removeNode(this.fileTree, path);
        } else {
          this.toastStore.error(res.error || '删除失败');
        }
      });

      if (!res.success) {
        await this.loadFileTree();
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      this.toastStore.error('删除失败');
      await this.loadFileTree();
    }
  }

  // Rename a file or directory
  async renameItem(oldPath: string, newName: string) {
    try {
      const res = await window.electronAPI.renameItem(oldPath, newName);
      if (res.success && res.data) {
        const newPath = res.data;
        const wasCurrentFile = this.currentFile?.path === oldPath;

        await this.loadFileTree();

        if (wasCurrentFile) {
          const newNode = this.findNode(this.fileTree, newPath);
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

  // Move a file or directory
  async moveItem(sourcePath: string, targetParentPath: string) {
    try {
      const res = await window.electronAPI.moveItem(sourcePath, targetParentPath);
      if (res.success && res.data) {
        const newPath = res.data;
        const wasCurrentFile = this.currentFile?.path === sourcePath;

        await this.loadFileTree();

        if (wasCurrentFile) {
          const newNode = this.findNode(this.fileTree, newPath);
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

  // Export methods - delegate to ExportStore for state
  async exportAsMarkdown(filePath: string, defaultName?: string) {
    try {
      const res = await window.electronAPI.readFile(filePath);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to read file');
      }

      const content = res.data;
      const fileName = defaultName || filePath.split('/').pop() || 'note.md';

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
  async batchExportNotes(directoryPath: string, format: ExportFormat) {
    const dirNode = this.findNode(this.fileTree, directoryPath);
    if (!dirNode) {
      this.toastStore.error('未找到该文件夹');
      return { success: false, error: 'Directory not found' };
    }

    const files = this.collectMarkdownFiles(dirNode);
    if (files.length === 0) {
      this.toastStore.warning('该文件夹中没有Markdown文件');
      return { success: false, error: 'No markdown files found' };
    }

    const saveRes = await window.electronAPI.openDirectory();
    if (!saveRes.success || !saveRes.data || saveRes.data.canceled) {
      return { success: false, error: 'Canceled' };
    }

    const exportDir = saveRes.data.filePaths[0];

    // Initialize export dialog
    this.exportStore.initializeExport(format, files);

    // Import marked for conversion
    const { marked } = await import('marked');
    marked.use({ breaks: true, gfm: true });

    const createRenderer = (filePath: string) => {
      const renderer = new marked.Renderer();

      renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
        if (!href) return text;

        let src = href;
        let style = '';

        try {
          const urlObj = new URL(href, 'http://dummy');
          const width = urlObj.searchParams.get('w');
          const height = urlObj.searchParams.get('h');

          if (width) style += `width: ${width};`;
          if (height) style += `height: ${height};`;
        } catch {
          // Ignore parsing errors
        }

        if (!href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('media:')) {
          const lastSlashIndex = filePath.lastIndexOf('/');
          if (lastSlashIndex !== -1) {
            const currentDir = filePath.substring(0, lastSlashIndex);
            const absolutePath = `${currentDir}/${href}`;
            src = `media://local${absolutePath}`;
          }
        }

        return `<img src="${src}" alt="${text}" title="${title || ''}" style="${style}" />`;
      };

      return renderer;
    };

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update progress
      this.exportStore.updateItemProgress(i, file.name, 'processing');
      this.exportStore.setCurrentFile(file.name);
      this.exportStore.updateProgress(i, (i / files.length) * 100);

      try {
        const fileRes = await window.electronAPI.readFile(file.path);
        if (!fileRes.success || !fileRes.data) {
          throw new Error(fileRes.error);
        }

        const content = fileRes.data;
        let result: { success: boolean; error?: string; path?: string };

        if (format === 'md') {
          const exportPath = `${exportDir}/${file.name}`;
          const saveRes = await window.electronAPI.saveFileDirect(exportPath, content);
          result = { success: saveRes.success, error: saveRes.error, path: saveRes.success ? exportPath : undefined };
        } else if (format === 'html') {
          const renderer = createRenderer(file.path);
          const htmlContent = await marked.parse(content, { renderer }) as string;
          const fileName = file.name.replace('.md', '.html');
          const exportPath = `${exportDir}/${fileName}`;
          const completeHtml = this.createHtmlDocument(file.name, htmlContent);
          const saveRes = await window.electronAPI.exportHtmlDirect(completeHtml, exportPath);
          result = { success: saveRes.success, error: saveRes.error, path: saveRes.data };
        } else {
          const renderer = createRenderer(file.path);
          const htmlContent = await marked.parse(content, { renderer }) as string;
          const fileName = file.name.replace('.md', '.pdf');
          const exportPath = `${exportDir}/${fileName}`;
          const completeHtml = this.createPdfHtmlDocument(htmlContent);
          const saveRes = await window.electronAPI.exportPdfDirect(completeHtml, exportPath);
          result = { success: saveRes.success, error: saveRes.error, path: saveRes.data };
        }

        if (result.success) {
          successCount++;
          this.exportStore.updateItemProgress(i, file.name, 'success');
        } else {
          failCount++;
          this.exportStore.updateItemProgress(i, file.name, 'error', result.error);
        }
      } catch (error) {
        failCount++;
        this.exportStore.updateItemProgress(i, file.name, 'error', error instanceof Error ? error.message : 'Export failed');
      }
    }

    // Finalize
    this.exportStore.updateProgress(files.length, 100);
    if (failCount > 0 && successCount === 0) {
      this.exportStore.markAsError();
    } else {
      this.exportStore.markAsCompleted();
    }

    // Show result message
    if (successCount === files.length) {
      this.toastStore.success(`已导出全部 ${files.length} 个文件`);
    } else if (successCount > 0) {
      this.toastStore.warning(`部分导出成功：${successCount}/${files.length}`);
    } else {
      this.toastStore.error('导出失败');
    }

    return { success: true };
  }

  closeExportDialog() {
    this.exportStore.closeDialog();
  }

  private createHtmlDocument(title: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title.replace('.md', '')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #fff; }
        img { max-width: 100%; height: auto; }
        pre { background: #f6f8fa; padding: 16px; overflow: auto; border-radius: 6px; }
        code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 85%; }
        blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; margin: 16px 0; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        table th, table td { border: 1px solid #ddd; padding: 8px 12px; }
        table th { background: #f6f8fa; }
        h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.25em; }
        a { color: #0969da; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .mermaid { text-align: center; margin: 20px 0; }
    </style>
</head>
<body>${content}</body>
</html>`;
  }

  private createPdfHtmlDocument(content: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; padding: 20mm; font-size: 11pt; }
        img { max-width: 100%; height: auto; }
        pre { background: #f6f8fa; padding: 12px; overflow: auto; border-radius: 4px; font-size: 9pt; }
        code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 9pt; }
        blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; margin: 16px 0; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 10pt; }
        table th, table td { border: 1px solid #ddd; padding: 6px 10px; }
        table th { background: #f6f8fa; }
        h1, h2, h3, h4, h5, h6 { margin-top: 18px; margin-bottom: 12px; font-weight: 600; line-height: 1.25; }
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.4em; }
        h3 { font-size: 1.2em; }
        a { color: #0969da; text-decoration: none; }
        .mermaid { text-align: center; margin: 20px 0; }
    </style>
</head>
<body>${content}</body>
</html>`;
  }

  // Favorites - delegate to FavoriteStore
  toggleFavorite(path: string) {
    this.favoriteStore.toggleFavorite(path);
  }

  isFavorite(path: string): boolean {
    return this.favoriteStore.isFavorite(path);
  }

  // Sort management
  toggleSort(dirPath: string) {
    runInAction(() => {
      const current = this.sortSettings.get(dirPath);
      if (current === 'asc') {
        this.sortSettings.set(dirPath, 'desc');
      } else if (current === 'desc') {
        this.sortSettings.delete(dirPath);
      } else {
        this.sortSettings.set(dirPath, 'asc');
      }
      this.saveSortSettings();
    });
  }

  getSortOrder(dirPath: string): 'asc' | 'desc' | null {
    return this.sortSettings.get(dirPath) || null;
  }

  getSortedChildren(node: FileNode): FileNode[] | null {
    if (!node.children || node.children.length === 0) return null;

    const sortOrder = this.getSortOrder(node.path);
    // 默认使用倒序排列 (5, 4, 3, 2, 1)
    const defaultOrder = sortOrder || 'desc';

    const sorted = [...node.children].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // 使用 numeric: true 实现自然排序，类似于 macOS Finder
      // 这样 "1.md" 会排在 "2.md" 和 "12.md" 前面
      const compare = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return defaultOrder === 'asc' ? compare : -compare;
    });

    return sorted;
  }

  private saveSortSettings() {
    try {
      const obj = Object.fromEntries(this.sortSettings);
      localStorage.setItem(SORT_SETTINGS_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('Failed to save sort settings:', e);
    }
  }

  private loadSortSettings() {
    try {
      const saved = localStorage.getItem(SORT_SETTINGS_STORAGE_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        this.sortSettings = new Map(Object.entries(obj));
      }
    } catch (e) {
      console.error('Failed to load sort settings:', e);
    }
  }

  // Helper methods
  private findNode(nodes: FileNode[], targetPath: string): FileNode | null {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = this.findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  private insertNode(nodes: FileNode[], parentPath: string, newNode: FileNode): boolean {
    for (const node of nodes) {
      if (node.path === parentPath && node.type === 'directory') {
        if (!node.children) node.children = [];
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
}

// Re-export types for convenience
export type { OpenTab };
export type { SearchResult };
export type { ExportFormat };
