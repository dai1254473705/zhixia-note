import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { configService } from './configService';
import { FileNode } from '../../src/types';

const IGNORED_NAMES = ['.git', '.gitignore', 'config.json', '.secret', '.DS_Store'];
const ATTACHMENT_DIR = 'files';
const MAX_DEPTH = 3; // 目录层级限制 (0: Root, 1: Dir, 2: Dir, 3: File)

export class FileService {

  private async getRootPath(): Promise<string> {
    const config = await configService.getConfig();
    return config.repoPath;
  }

  // Generate a stable ID based on the file path
  private generateStableId(filePath: string): string {
    // Normalize path to ensure consistency (handle slashes, redundancy)
    let normalized = path.normalize(filePath);
    // On macOS/Windows, file system is case-insensitive usually. 
    // To ensure ID consistency even if path casing differs slightly contextually,
    // we should validly considering lower-casing for hash generation on these platforms.
    // However, purely relying on path.normalize is a safer first step.
    if (process.platform === 'darwin' || process.platform === 'win32') {
      normalized = normalized.toLowerCase();
    }
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async getFileTree(): Promise<FileNode[]> {
    const rootPath = await this.getRootPath();
    if (!rootPath) return []; // Or throw

    await fs.ensureDir(rootPath);
    return this.readDirRecursive(rootPath, 0);
  }

  private async readDirRecursive(dirPath: string, level: number): Promise<FileNode[]> {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const item of items) {
      if (IGNORED_NAMES.includes(item.name)) continue;

      const itemPath = path.join(dirPath, item.name);
      const isDirectory = item.isDirectory();

      // Skip if max depth reached for directories
      // if (isDirectory && level >= MAX_DEPTH - 1) continue; 
      // Actually, we want to show them but maybe disable creation inside?
      // Let's read what exists.

      const node: FileNode = {
        id: this.generateStableId(itemPath), // Use stable ID
        name: item.name,
        path: itemPath,
        type: isDirectory ? 'directory' : 'file',
        level: level,
        children: isDirectory ? await this.readDirRecursive(itemPath, level + 1) : undefined
      };

      nodes.push(node);
    }

    // Sort: Directories first, then files
    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  }

  async readFile(filePath: string): Promise<string> {
    await this.validatePath(filePath);
    return fs.readFile(filePath, 'utf-8');
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    await this.validatePath(filePath);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async createFile(parentPath: string, name: string): Promise<FileNode> {
    const fullPath = path.join(parentPath, name);
    await this.validatePath(fullPath);

    // Check depth
    const rootPath = await this.getRootPath();
    const relativePath = path.relative(rootPath, fullPath);
    const depth = relativePath.split(path.sep).length;
    // level 1: file.md
    // level 2: dir/file.md
    // level 3: dir/dir/file.md
    if (depth > MAX_DEPTH) {
      throw new Error(`Exceeds maximum directory depth of ${MAX_DEPTH}`);
    }

    if (await fs.pathExists(fullPath)) {
      throw new Error('File already exists');
    }

    await fs.ensureFile(fullPath);

    return {
      id: this.generateStableId(fullPath),
      name,
      path: fullPath,
      type: 'file',
      level: depth - 1 // level 0 based
    };
  }

  async createDirectory(parentPath: string, name: string): Promise<FileNode> {
    const fullPath = path.join(parentPath, name);
    await this.validatePath(fullPath);

    const rootPath = await this.getRootPath();
    const relativePath = path.relative(rootPath, fullPath);
    const depth = relativePath.split(path.sep).length;

    // Allow max depth - 1 for folders, so files can be inside
    if (depth > MAX_DEPTH) {
      throw new Error(`Cannot create directory at this depth (Max ${MAX_DEPTH})`);
    }

    let finalName = name;
    let finalPath = fullPath;
    let counter = 1;

    while (await fs.pathExists(finalPath)) {
      finalName = `${name} ${counter}`;
      finalPath = path.join(parentPath, finalName);
      counter++;
    }

    await fs.ensureDir(finalPath);

    return {
      id: this.generateStableId(finalPath),
      name: finalName,
      path: finalPath,
      type: 'directory',
      level: depth - 1,
      children: []
    };
  }

  async deleteItem(itemPath: string): Promise<void> {
    await this.validatePath(itemPath);
    await fs.remove(itemPath);
  }

  async renameItem(oldPath: string, newName: string): Promise<{ newPath: string }> {
    await this.validatePath(oldPath);
    const newPath = path.join(path.dirname(oldPath), newName);
    await this.validatePath(newPath);

    if (await fs.pathExists(newPath)) {
      throw new Error('Destination already exists');
    }

    await fs.rename(oldPath, newPath);
    return { newPath };
  }

  async moveItem(sourcePath: string, targetParentPath: string): Promise<{ newPath: string }> {
    await this.validatePath(sourcePath);
    await this.validatePath(targetParentPath);

    const sourceName = path.basename(sourcePath);
    const newPath = path.join(targetParentPath, sourceName);

    await this.validatePath(newPath);

    if (await fs.pathExists(newPath)) {
      throw new Error('Destination already exists');
    }

    await fs.move(sourcePath, newPath);
    return { newPath };
  }

  /**
   * Save attachment to files/ directory
   * @returns Relative path to be used in markdown (e.g., "files/image.png")
   */
  async saveAttachment(fileBuffer: Buffer, fileName: string): Promise<string> {
    const rootPath = await this.getRootPath();
    if (!rootPath) throw new Error('Root path not configured');

    const filesDir = path.join(rootPath, ATTACHMENT_DIR);
    await fs.ensureDir(filesDir);

    // Generate unique name to prevent collisions
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueName = `${baseName}-${Date.now()}${ext}`;
    const filePath = path.join(filesDir, uniqueName);

    await fs.writeFile(filePath, fileBuffer);

    // Return relative path for Markdown
    return `${ATTACHMENT_DIR}/${uniqueName}`;
  }

  /**
   * Copy external file to assets directory relative to the current markdown file
   * @param sourcePath Absolute path of the source file
   * @param currentMdPath Absolute path of the current markdown file
   * @returns Relative path to be used in markdown
   */
  async copyToAssets(sourcePath: string, currentMdPath: string): Promise<string> {
    console.log('[FileService] copyToAssets', { sourcePath, currentMdPath });
    await this.validatePath(currentMdPath);
    // Note: sourcePath is external, so we don't validate it against rootPath

    const assetsDirName = 'files';
    const currentDir = path.dirname(currentMdPath);
    const assetsDir = path.join(currentDir, assetsDirName);

    console.log('[FileService] assetsDir', assetsDir);

    await fs.ensureDir(assetsDir);

    const ext = path.extname(sourcePath);
    const originalName = path.basename(sourcePath, ext);
    let fileName = `${originalName}${ext}`;
    let targetPath = path.join(assetsDir, fileName);

    // Handle name collision by appending timestamp
    if (await fs.pathExists(targetPath)) {
      fileName = `${originalName}-${Date.now()}${ext}`;
      targetPath = path.join(assetsDir, fileName);
    }

    console.log('[FileService] Copying to', targetPath);

    await fs.copyFile(sourcePath, targetPath);

    // Return relative path: "files/filename.png"
    // Use posix style separators for Markdown compatibility
    return `${assetsDirName}/${fileName}`;
  }

  /**
   * 保存粘贴的文件到 assets 文件夹
   * @param fileName 文件名
   * @param fileData 文件数据 (Buffer)
   * @param currentMdPath 当前 markdown 文件的绝对路径
   * @returns 相对路径，用于 markdown 引用
   */
  async savePastedFile(fileName: string, fileData: Buffer, currentMdPath: string): Promise<string> {
    console.log('[FileService] savePastedFile', { fileName, currentMdPath });
    await this.validatePath(currentMdPath);

    const assetsDirName = 'files';
    const currentDir = path.dirname(currentMdPath);
    const assetsDir = path.join(currentDir, assetsDirName);

    console.log('[FileService] assetsDir', assetsDir);

    await fs.ensureDir(assetsDir);

    const ext = path.extname(fileName);
    const originalName = path.basename(fileName, ext);
    let targetFileName = fileName;
    let targetPath = path.join(assetsDir, fileName);

    // Handle name collision by appending timestamp
    if (await fs.pathExists(targetPath)) {
      targetFileName = `${originalName}-${Date.now()}${ext}`;
      targetPath = path.join(assetsDir, targetFileName);
    }

    console.log('[FileService] Saving pasted file to', targetPath);

    await fs.writeFile(targetPath, fileData);

    // Return relative path: "files/filename.png"
    return `${assetsDirName}/${targetFileName}`;
  }

  private async validatePath(targetPath: string) {
    const rootPath = await this.getRootPath();
    if (!rootPath || !targetPath.startsWith(rootPath)) {
      throw new Error('Access denied: Path is outside the notebook root.');
    }
  }

  /**
   * Search content in markdown files
   * @param query Search query string
   * @returns Array of search results with file path and matching lines
   */
  async searchContent(query: string): Promise<Array<{ path: string; name: string; matches: string[] }>> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const rootPath = await this.getRootPath();
    if (!rootPath) return [];

    const results: Array<{ path: string; name: string; matches: string[] }> = [];
    const lowerQuery = query.toLowerCase();

    // Recursively search through all markdown files
    const searchInDir = async (dirPath: string): Promise<void> => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          if (IGNORED_NAMES.includes(item.name)) continue;

          const itemPath = path.join(dirPath, item.name);

          if (item.isDirectory()) {
            // Recursively search subdirectories
            await searchInDir(itemPath);
          } else if (item.name.endsWith('.md')) {
            // Search in markdown files
            try {
              const content = await fs.readFile(itemPath, 'utf-8');
              const lines = content.split('\n');
              const matches: string[] = [];

              // Find all matching lines
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.toLowerCase().includes(lowerQuery)) {
                  // Store line number (1-indexed) and line content
                  matches.push(`[${i + 1}] ${line.trim()}`);
                }
              }

              // Only include files with at least one match
              if (matches.length > 0) {
                results.push({
                  path: itemPath,
                  name: item.name,
                  matches: matches.slice(0, 10) // Limit to 10 matches per file
                });
              }
            } catch (error) {
              console.error(`Error reading file ${itemPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    await searchInDir(rootPath);

    // Limit total results to prevent performance issues
    return results.slice(0, 50);
  }
}

export const fileService = new FileService();
