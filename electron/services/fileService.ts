import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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
        id: uuidv4(), // In a real app, might want stable IDs based on path hash
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
      id: uuidv4(),
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
      id: uuidv4(),
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

  async renameItem(oldPath: string, newName: string): Promise<void> {
    await this.validatePath(oldPath);
    const newPath = path.join(path.dirname(oldPath), newName);
    await this.validatePath(newPath);
    
    if (await fs.pathExists(newPath)) {
      throw new Error('Destination already exists');
    }
    
    await fs.rename(oldPath, newPath);
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

  private async validatePath(targetPath: string) {
    const rootPath = await this.getRootPath();
    if (!rootPath || !targetPath.startsWith(rootPath)) {
      throw new Error('Access denied: Path is outside the notebook root.');
    }
  }
}

export const fileService = new FileService();
