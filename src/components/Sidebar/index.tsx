import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { cn } from '../../utils/cn';
import logo from '../../assets/zhixia-logo.svg';
import type { FileNode } from '../../types';
import { 
  Folder, 
  FileText, 
  Plus, 
  MoreVertical, 
  Trash, 
  FolderPlus,
  FilePlus,
  Edit2,
  Home,
  ExternalLink,
  ChevronRight,
  RotateCw
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const FileTreeItem = observer(({ node, level }: { node: FileNode; level: number }) => {
  const { fileStore, gitStore } = useStore();
  const isSelected = fileStore.currentFile?.path === node.path;
  const isFolder = node.type === 'directory';
  const isModified = !isFolder && fileStore.unsavedFilePaths.has(node.path); // Unsaved to disk
  const isMd = node.name.endsWith('.md');
  const displayName = isMd ? node.name.slice(0, -3) : node.name;
  
  // Git Status Logic
  const gitStatus = gitStore.status.files[node.path];
  // 'index' is staged status, 'working_dir' is unstaged status
  // If 'working_dir' is 'M' -> Modified (needs add)
  // If 'index' is 'M' or 'A' -> Staged (needs commit)
  // If 'working_dir' is '?' -> Untracked (needs add)
  
  const isGitModified = gitStatus?.working_dir === 'M' || gitStatus?.working_dir === '?';
  const isGitStaged = gitStatus?.index === 'M' || gitStatus?.index === 'A';
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(displayName);

  // Sync renameValue when displayName changes (e.g. external rename)
  useEffect(() => {
    setRenameValue(displayName);
  }, [displayName]);

  const handleSelect = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
      // Allow selecting any file, not just MD
      // If it's an image, maybe we want to preview it?
      // For now, Editor handles text content.
      // If it's a binary file, readFile might return garbage or error.
      // We should probably check extension or try to read and handle error.
      fileStore.selectFile(node);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isMd ? `${renameValue.trim()}.md` : renameValue.trim();
    if (finalName && finalName !== node.name) {
      await fileStore.renameItem(node.path, finalName);
    }
    setIsRenaming(false);
  };

  if (isRenaming) {
     return (
        <div style={{ paddingLeft: `${level * 12 + 12}px` }} className="py-1 pr-2">
            <form onSubmit={handleRename} className="flex items-center">
                {isFolder ? <Folder size={16} className="mr-2 text-gray-500" /> : <FileText size={16} className="mr-2 text-gray-500" />}
                <input 
                   autoFocus
                   className="flex-1 min-w-0 text-sm border rounded px-1 outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-gray-800 dark:text-gray-200"
                   value={renameValue}
                   onChange={e => setRenameValue(e.target.value)}
                   onBlur={handleRename}
                   onClick={e => e.stopPropagation()}
                />
            </form>
        </div>
     );
  }

  return (
    <div>
        <div 
          className={cn(
            "group flex items-center py-1.5 pr-2 cursor-pointer transition-colors rounded-r-md mr-2 text-sm select-none",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            isSelected && "bg-primary/10 dark:bg-primary/20 text-primary font-medium"
          )}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
          onClick={handleSelect}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsRenaming(true);
          }}
        >
          {/* Git Status Indicators */}
          <div className="absolute left-1 flex flex-col gap-0.5">
             {/* Unsaved to disk (Red Dot) */}
             {isModified && (
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Unsaved to disk" />
             )}
             {/* Git Modified (Yellow 'M') */}
             {isGitModified && !isModified && (
                <span className="text-[10px] font-bold text-amber-500 leading-none" title="Modified (Needs Add)">M</span>
             )}
             {/* Git Staged (Green 'A' or 'C') */}
             {isGitStaged && (
                <span className="text-[10px] font-bold text-emerald-500 leading-none" title="Staged (Needs Commit)">S</span>
             )}
          </div>

          {isFolder ? (
            <Folder size={16} className={cn("mr-2 transition-colors", isSelected ? "text-primary" : "text-gray-400")} />
          ) : (
            <FileText size={16} className={cn("mr-2 transition-colors", isSelected ? "text-primary" : "text-gray-400")} />
          )}
          
          <span className="truncate flex-1">{displayName}</span>
          
          {isFolder && node.children && node.children.length > 0 && (
             <ChevronRight 
               size={14} 
               className={cn(
                 "text-gray-400 transition-transform mr-1 shrink-0", 
                 isExpanded ? "rotate-90" : ""
               )} 
             />
          )}

          {/* Context Menu Trigger */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
               <button 
                 className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-opacity"
                 onClick={e => e.stopPropagation()}
               >
                 <MoreVertical size={14} className="text-gray-500" />
               </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="min-w-[160px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                sideOffset={5}
                align="start"
              >
                 {/* Universal Create Options */}
                 <DropdownMenu.Item 
                  className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none" 
                  onSelect={() => fileStore.createFile(isFolder ? node.path : node.path.split('/').slice(0, -1).join('/'), 'New Note.md')}
                >
                  <FilePlus size={14} className="mr-2" /> New Note
                </DropdownMenu.Item>
                {/* Limit max depth: Level 0 (Root) -> Level 1 -> Level 2. No folders in Level 2. */}
                {level < 2 && (
                  <DropdownMenu.Item 
                    className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none" 
                    onSelect={() => fileStore.createDir(isFolder ? node.path : node.path.split('/').slice(0, -1).join('/'), 'New Folder')}
                  >
                    <FolderPlus size={14} className="mr-2" /> New Folder
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                 <DropdownMenu.Item 
                   className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded outline-none" 
                   onSelect={() => setIsRenaming(true)}
                 >
                   <Edit2 size={14} className="mr-2" /> Rename
                 </DropdownMenu.Item>
                 
                 <DropdownMenu.Item 
                   className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded outline-none" 
                   onSelect={() => gitStore.openPath(node.path)}
                 >
                   <ExternalLink size={14} className="mr-2" /> Show in Finder
                 </DropdownMenu.Item>

                 <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                 <DropdownMenu.Item 
                   className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded outline-none" 
                   onSelect={() => {
                     if (confirm(`Delete ${displayName}?`)) {
                       fileStore.deleteItem(node.path);
                     }
                   }}
                 >
                   <Trash size={14} className="mr-2" /> Delete
                 </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        
        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(child => (
              <FileTreeItem key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
    </div>
  );
});

import { Search } from 'lucide-react';

export const Sidebar = observer(() => {
  const { fileStore, uiStore } = useStore();

  useEffect(() => {
    fileStore.loadFileTree();
  }, [fileStore]);

  if (!uiStore.isSidebarOpen) return null;

  return (
    <div className="w-64 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-200">
      {/* Header */}
      <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10" />
          <span className="font-bold text-lg text-gray-700 dark:text-gray-200">知夏笔记</span>
        </div>
        <div className="flex items-center gap-1">
           <button 
             onClick={() => fileStore.loadFileTree()}
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="Refresh"
           >
             <RotateCw size={16} className={fileStore.isLoading ? "animate-spin" : ""} />
           </button>
           <button 
             onClick={() => uiStore.resetProject()}  
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="Switch Project"
           >
             <Home size={16} />
           </button>
           <button 
             onClick={() => fileStore.createFile(fileStore.rootPath, 'New Note.md')} 
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="New Note"
           >
             <Plus size={16} />
           </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
            value={fileStore.searchQuery}
            onChange={(e) => fileStore.setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {fileStore.filteredFiles.length === 0 && !fileStore.isLoading ? (
          <div className="text-center text-xs text-gray-400 mt-10">
            {fileStore.searchQuery ? 'No results found' : 'No files yet'}
          </div>
        ) : (
          fileStore.filteredFiles.map(node => (
            <FileTreeItem key={node.id} node={node} level={0} />
          ))
        )}
      </div>
    </div>
  );
});

export default Sidebar;
