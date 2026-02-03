import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';

export interface Tag {
  name: string;
  count: number;
  color?: string;
}

export interface FileTags {
  filePath: string;
  tags: string[];
}

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export class TagStore {
  // Map of tag name to tag info
  tagsMap: Map<string, Tag> = new Map();

  // Map of file path to its tags
  fileTagsMap: Map<string, string[]> = new Map();

  // Currently selected tag for filtering
  selectedTag: string | null = null;

  isLoading: boolean = false;

  private readonly STORAGE_KEY = 'zhixia-tags';

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as { tags: Record<string, Tag>; fileTags: Record<string, string[]> };
        runInAction(() => {
          this.tagsMap = new Map(Object.entries(data.tags || {}));
          this.fileTagsMap = new Map(Object.entries(data.fileTags || {}));
        });
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        tags: Object.fromEntries(this.tagsMap),
        fileTags: Object.fromEntries(this.fileTagsMap),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save tags:', error);
    }
  }

  // Get color for a tag (consistent based on tag name)
  getTagColor(tagName: string): string {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  }

  // Parse tags from markdown content
  // Supports both frontmatter tags and inline #tag syntax
  parseTagsFromContent(content: string): string[] {
    const tags = new Set<string>();

    // Parse frontmatter tags
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      // Match tags: - tag or tags: [tag1, tag2] or tags: tag1, tag2
      const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]+)\]|tags:\s*(.+)|-\s*(.+)/g);
      if (tagsMatch) {
        tagsMatch.forEach(match => {
          const values = match
            .replace(/tags:\s*\[|\]|\n|tags:\s*|-\s*/g, '')
            .split(/[,\s]+/)
            .filter(t => t.trim())
            .map(t => t.replace(/^["']|["']$/g, '').trim());
          values.forEach(v => v && tags.add(v));
        });
      }
    }

    // Parse inline tags (#tag but not in code blocks)
    const lines = content.split('\n');
    let inCodeBlock = false;
    for (const line of lines) {
      // Check for code block boundaries
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      // Find tags at the end of line or standalone
      const tagMatches = line.matchAll(/(?<=\s|^)#([a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5_-]*)/g);
      for (const match of tagMatches) {
        const tag = match[1];
        // Skip common markdown elements
        if (!/^h[1-6]$/i.test(tag) && !match.index) {
          tags.add(tag);
        }
      }
    }

    return Array.from(tags);
  }

  // Update tags for a file
  updateFileTags(filePath: string, tags: string[]) {
    const oldTags = this.fileTagsMap.get(filePath) || [];

    runInAction(() => {
      // Remove file from old tags
      oldTags.forEach(tag => {
        const tagInfo = this.tagsMap.get(tag);
        if (tagInfo) {
          tagInfo.count--;
          if (tagInfo.count <= 0) {
            this.tagsMap.delete(tag);
          }
        }
      });

      // Set new tags for file
      this.fileTagsMap.set(filePath, tags);

      // Add file to new tags
      tags.forEach(tag => {
        const existing = this.tagsMap.get(tag);
        if (existing) {
          existing.count++;
        } else {
          this.tagsMap.set(tag, {
            name: tag,
            count: 1,
            color: this.getTagColor(tag),
          });
        }
      });
    });

    this.saveToStorage();
  }

  // Get tags for a specific file
  getFileTags(filePath: string): string[] {
    return this.fileTagsMap.get(filePath) || [];
  }

  // Get all tags sorted by count
  getAllTags(): Tag[] {
    return Array.from(this.tagsMap.values()).sort((a, b) => b.count - a.count);
  }

  // Get tag info
  getTag(tagName: string): Tag | undefined {
    return this.tagsMap.get(tagName);
  }

  // Select a tag for filtering
  setSelectedTag(tagName: string | null) {
    this.selectedTag = tagName;
  }

  // Check if a file has a specific tag
  fileHasTag(filePath: string, tagName: string): boolean {
    const tags = this.fileTagsMap.get(filePath);
    return tags ? tags.includes(tagName) : false;
  }

  // Get files with a specific tag
  getFilesWithTag(tagName: string): string[] {
    const files: string[] = [];
    this.fileTagsMap.forEach((tags, filePath) => {
      if (tags.includes(tagName)) {
        files.push(filePath);
      }
    });
    return files;
  }

  // Delete a tag
  deleteTag(tagName: string) {
    runInAction(() => {
      this.tagsMap.delete(tagName);
      // Remove tag from all files
      this.fileTagsMap.forEach((tags, filePath) => {
        const newTags = tags.filter(t => t !== tagName);
        this.fileTagsMap.set(filePath, newTags);
      });
      if (this.selectedTag === tagName) {
        this.selectedTag = null;
      }
    });
    this.saveToStorage();
  }

  // Rename a tag
  renameTag(oldName: string, newName: string) {
    runInAction(() => {
      const tagInfo = this.tagsMap.get(oldName);
      if (!tagInfo) return;

      // Update tags map
      this.tagsMap.delete(oldName);
      this.tagsMap.set(newName, { ...tagInfo, name: newName });

      // Update all files
      this.fileTagsMap.forEach((tags, filePath) => {
        if (tags.includes(oldName)) {
          const newTags = tags.map(t => t === oldName ? newName : t);
          this.fileTagsMap.set(filePath, newTags);
        }
      });

      if (this.selectedTag === oldName) {
        this.selectedTag = newName;
      }
    });
    this.saveToStorage();
  }

  // Build tag index from all files
  async buildIndex(allFiles: FileNode[], readFile: (path: string) => Promise<string>) {
    this.isLoading = true;

    runInAction(() => {
      this.tagsMap.clear();
      this.fileTagsMap.clear();
    });

    try {
      // Collect all markdown files (skip hidden directories)
      const mdFiles: FileNode[] = [];
      const collectMd = (node: FileNode) => {
        // Skip hidden directories (starting with .)
        if (node.type === 'directory' && node.name.startsWith('.')) {
          return;
        }
        if (node.type === 'file' && node.name.endsWith('.md')) {
          mdFiles.push(node);
        } else if (node.type === 'directory' && node.children) {
          node.children.forEach(collectMd);
        }
      };
      allFiles.forEach(collectMd);

      for (const file of mdFiles) {
        try {
          const content = await readFile(file.path);
          const tags = this.parseTagsFromContent(content);
          this.updateFileTags(file.path, tags);
        } catch (error) {
          console.error(`Failed to parse tags from ${file.path}:`, error);
        }
      }
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }

    this.saveToStorage();
  }

  // Clear all data
  clear() {
    runInAction(() => {
      this.tagsMap.clear();
      this.fileTagsMap.clear();
      this.selectedTag = null;
    });
    this.saveToStorage();
  }
}
