import { makeAutoObservable, runInAction } from 'mobx';
import type { FileNode } from '../types';

export interface Wikilink {
  target: string; // The file name being linked to
  alias?: string; // Optional display text
  position: { start: number; end: number }; // Position in source
}

export interface Backlink {
  sourcePath: string; // File that contains the link
  sourceName: string; // File name
  context: string; // Surrounding text for preview
  alias?: string; // Display text if different from target
}

export class BacklinkStore {
  // Map of file -> files that link to it (backlinks)
  backlinksMap: Map<string, Backlink[]> = new Map();

  // Map of file -> files it links to (outgoing links)
  linksMap: Map<string, Wikilink[]> = new Map();

  isLoading: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }

  // Parse wikilinks from markdown content
  parseWikilinks(content: string, _currentFileName: string): Wikilink[] {
    const links: Wikilink[] = [];
    const regex = /\[\[([^\]]+)(?:\|([^\]]+))?\]\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      const target = match[1];
      const alias = match[2];

      // Check if it's a valid wikilink (not an escaped link)
      if (!fullMatch.startsWith('\\')) {
        links.push({
          target,
          alias,
          position: { start: match.index, end: match.index + fullMatch.length }
        });
      }
    }

    return links;
  }

  // Extract links from a file
  extractLinksFromFile(fileName: string, content: string): Wikilink[] {
    const links = this.parseWikilinks(content, fileName);

    runInAction(() => {
      this.linksMap.set(fileName, links);
    });

    return links;
  }

  // Update backlinks when a file is modified
  updateBacklinks(fileName: string, oldContent: string, newContent: string, _allFiles: FileNode[]) {
    // Remove old backlinks
    const oldLinks = this.parseWikilinks(oldContent, fileName);
    this.removeBacklinks(fileName, oldLinks);

    // Add new backlinks
    const newLinks = this.parseWikilinks(newContent, fileName);
    this.addBacklinks(fileName, newLinks);

    // Update links map
    runInAction(() => {
      this.linksMap.set(fileName, newLinks);
    });
  }

  // Add backlinks from a source file
  addBacklinks(sourcePath: string, links: Wikilink[]) {
    for (const link of links) {
      const target = link.target.toLowerCase().trim();

      runInAction(() => {
        if (!this.backlinksMap.has(target)) {
          this.backlinksMap.set(target, []);
        }

        const backlinks = this.backlinksMap.get(target)!;
        // Check if this backlink already exists
        const exists = backlinks.some(b => b.sourcePath === sourcePath);
        if (!exists) {
          backlinks.push({
            sourcePath,
            sourceName: this.getFileNameFromPath(sourcePath),
            context: '', // Will be updated when content is loaded
            alias: link.alias
          });
        }
      });
    }
  }

  // Remove backlinks from a source file
  removeBacklinks(sourcePath: string, links: Wikilink[]) {
    for (const link of links) {
      const target = link.target.toLowerCase().trim();

      runInAction(() => {
        if (this.backlinksMap.has(target)) {
          const backlinks = this.backlinksMap.get(target)!;
          // Filter out backlinks from this source
          this.backlinksMap.set(
            target,
            backlinks.filter(b => b.sourcePath !== sourcePath)
          );
        }
      });
    }
  }

  // Get backlinks for a file
  getBacklinks(fileName: string): Backlink[] {
    return this.backlinksMap.get(fileName.toLowerCase().trim()) || [];
  }

  // Get outgoing links for a file
  getLinks(fileName: string): Wikilink[] {
    return this.linksMap.get(fileName) || [];
  }

  // Get backlink count for a file
  getBacklinkCount(fileName: string): number {
    return this.getBacklinks(fileName).length;
  }

  // Build the entire backlink index from all files
  async buildIndex(allFiles: FileNode[], readFile: (path: string) => Promise<string>) {
    this.isLoading = true;

    runInAction(() => {
      this.backlinksMap.clear();
      this.linksMap.clear();
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

      // Process each file
      for (const file of mdFiles) {
        try {
          const content = await readFile(file.path);
          const fileName = file.name.replace('.md', '');
          const links = this.parseWikilinks(content, fileName);

          runInAction(() => {
            this.linksMap.set(fileName, links);
          });

          this.addBacklinks(file.path, links);
        } catch (error) {
          console.error(`Failed to process ${file.path}:`, error);
        }
      }
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  // Resolve a wikilink to a file path
  resolveLink(target: string, allFiles: FileNode[]): string | null {
    const cleanTarget = target.toLowerCase().trim();

    // First, try exact match
    for (const file of this.getAllFiles(allFiles)) {
      const fileName = file.name.replace('.md', '').toLowerCase();
      if (fileName === cleanTarget) {
        return file.path;
      }
    }

    // Try case-insensitive match
    for (const file of this.getAllFiles(allFiles)) {
      if (file.name.replace('.md', '').toLowerCase() === cleanTarget) {
        return file.path;
      }
    }

    // Try partial match
    for (const file of this.getAllFiles(allFiles)) {
      if (file.name.replace('.md', '').toLowerCase().includes(cleanTarget)) {
        return file.path;
      }
    }

    return null;
  }

  // Helper to get all file nodes
  private getAllFiles(nodes: FileNode[]): FileNode[] {
    const files: FileNode[] = [];
    const collect = (node: FileNode) => {
      if (node.type === 'file') {
        files.push(node);
      } else if (node.type === 'directory' && node.children) {
        node.children.forEach(collect);
      }
    };
    nodes.forEach(collect);
    return files;
  }

  // Helper to extract file name from path
  private getFileNameFromPath(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  // Clear all data
  clear() {
    runInAction(() => {
      this.backlinksMap.clear();
      this.linksMap.clear();
    });
  }
}
