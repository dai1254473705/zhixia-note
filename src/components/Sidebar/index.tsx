import React, { useEffect, useState, useRef, useCallback, createContext } from 'react';
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
  RotateCw,
  Search,
  GripVertical,
  Loader2,
  Download,
  FoldVertical,
  UnfoldVertical
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ExportProgressDialog } from '../ExportProgressDialog';
import type { ExportProgressItem } from '../../store/FileStore';

// Create context for expand/collapse state
interface ExpandContextType {
  expandAll: boolean | null;
  setExpandAll: (value: boolean | null) => void;
}

const ExpandContext = createContext<ExpandContextType>({
  expandAll: null,
  setExpandAll: () => {}
});

const FileTreeItem = observer(({ node, level }: {
  node: FileNode;
  level: number;
}) => {
  const { fileStore, gitStore } = useStore();
  const expandContext = React.useContext(ExpandContext);
  const isSelected = fileStore.currentFile?.path === node.path;
  const isFolder = node.type === 'directory';
  const isModified = !isFolder && fileStore.unsavedFilePaths.has(node.path);
  const isMd = node.name.endsWith('.md');
  const displayName = isMd ? node.name.slice(0, -3) : node.name;

  const gitStatus = gitStore.status.files[node.path];
  const isGitModified = gitStatus?.working_dir === 'M' || gitStatus?.working_dir === '?';
  const isGitStaged = gitStatus?.index === 'M' || gitStatus?.index === 'A';

  // 默认折叠文件夹，只有level 0的根目录才展开
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(displayName);

  // Listen to global expand/collapse state changes
  useEffect(() => {
    if (isFolder) {
      if (expandContext.expandAll !== null) {
        setIsExpanded(expandContext.expandAll);
      } else {
        // Reset to default: level 0 expanded, others collapsed
        setIsExpanded(level === 0);
      }
    }
  }, [expandContext.expandAll, isFolder, level]);

  useEffect(() => {
    setRenameValue(displayName);
  }, [displayName]);

  const handleSelect = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    } else {
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
        <Tooltip.Provider delayDuration={500}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
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
                   {isModified && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Unsaved" />
                   )}
                   {isGitModified && !isModified && (
                      <span className="text-[10px] font-bold text-amber-500 leading-none" title="Modified">M</span>
                   )}
                   {isGitStaged && (
                      <span className="text-[10px] font-bold text-emerald-500 leading-none" title="Staged">S</span>
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
                       <DropdownMenu.Item
                        className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
                        onSelect={() => fileStore.createFile(isFolder ? node.path : node.path.split('/').slice(0, -1).join('/'), 'New Note.md')}
                      >
                        <FilePlus size={14} className="mr-2" /> New Note
                      </DropdownMenu.Item>
                      {level < 2 && (
                        <DropdownMenu.Item
                          className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
                          onSelect={() => fileStore.createDir(isFolder ? node.path : node.path.split('/').slice(0, -1).join('/'), 'New Folder')}
                        >
                          <FolderPlus size={14} className="mr-2" /> New Folder
                        </DropdownMenu.Item>
                      )}

                      {/* Export Menu for Folders */}
                      {isFolder && (
                        <>
                          <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                          <DropdownMenu.Sub>
                            <DropdownMenu.SubTrigger className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none">
                              <Download size={14} className="mr-2" />
                              批量导出
                              <ChevronRight size={12} className="ml-auto" />
                            </DropdownMenu.SubTrigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.SubContent
                                className="min-w-[140px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50"
                                sideOffset={5}
                              >
                                <DropdownMenu.Item
                                  className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
                                  onSelect={async () => {
                                    await fileStore.batchExportNotes(node.path, 'md');
                                  }}
                                >
                                  <FileText size={14} className="mr-2" /> 导出为 MD
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
                                  onSelect={async () => {
                                    await fileStore.batchExportNotes(node.path, 'html');
                                  }}
                                >
                                  <FileText size={14} className="mr-2" /> 导出为 HTML
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary rounded outline-none"
                                  onSelect={async () => {
                                    await fileStore.batchExportNotes(node.path, 'pdf');
                                  }}
                                >
                                  <FileText size={14} className="mr-2" /> 导出为 PDF
                                </DropdownMenu.Item>
                              </DropdownMenu.SubContent>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Sub>
                        </>
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
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg z-50 max-w-xs"
                sideOffset={5}
              >
                {displayName}
                <Tooltip.Arrow className="fill-gray-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>

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

// Search Result Item Component
const SearchResultItem = observer(({ result }: { result: { path: string; name: string; matches: string[] } }) => {
  const { fileStore } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = () => {
    // Find the file node in the file tree and select it
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

    const node = findNode(fileStore.fileTree, result.path);
    if (node) {
      fileStore.selectFile(node);
    }
  };

  const displayName = result.name.endsWith('.md') ? result.name.slice(0, -3) : result.name;

  return (
    <div className="px-2 py-1">
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div
              className={cn(
                "group flex items-center py-1.5 px-2 cursor-pointer transition-colors rounded-md text-sm select-none",
                "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <FileText size={16} className="mr-2 text-gray-400 shrink-0" />
              <span className="flex-1 truncate">{displayName}</span>
              <span className="text-xs text-gray-400 ml-2">{result.matches.length} 个匹配</span>
              <ChevronRight
                size={14}
                className={cn("text-gray-400 transition-transform shrink-0 ml-1", isExpanded ? "rotate-90" : "")}
              />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="px-2 py-1 text-xs bg-gray-900 text-white rounded shadow-lg z-50 max-w-xs"
              sideOffset={5}
            >
              点击查看匹配内容
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-1">
          {result.matches.slice(0, 5).map((match, idx) => (
            <div
              key={idx}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary cursor-pointer px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50"
              onClick={handleSelect}
              title={match}
            >
              {match.length > 80 ? match.slice(0, 80) + '...' : match}
            </div>
          ))}
          {result.matches.length > 5 && (
            <div className="text-xs text-gray-400 px-2 italic">
              还有 {result.matches.length - 5} 个匹配...
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export const Sidebar = observer(() => {
  const { fileStore, uiStore } = useStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const newWidth = e.clientX;
        uiStore.setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [uiStore]);

  useEffect(() => {
    fileStore.loadFileTree();
  }, [fileStore]);

  if (!uiStore.isSidebarOpen) return null;

  return (
    <div
      ref={sidebarRef}
      className="h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-200 relative"
      style={{ width: `${uiStore.sidebarWidth}px` }}
    >
      {/* Resizable Handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-10",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
        title="拖拽调整宽度"
      >
        <GripVertical size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary" />
      </div>

      {/* Header */}
      <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Logo" className="w-10 h-10 shrink-0 dark:brightness-0 dark:invert" />
          <span className="font-bold text-lg text-gray-700 dark:text-gray-200 truncate">知夏笔记</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
           <DropdownMenu.Root>
             <DropdownMenu.Trigger asChild>
               <button
                 className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
                 title="展开/折叠菜单"
               >
                 <UnfoldVertical size={16} />
               </button>
             </DropdownMenu.Trigger>

             <DropdownMenu.Portal>
               <DropdownMenu.Content
                 className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] z-50"
                 align="end"
                 sideOffset={5}
               >
                 <DropdownMenu.Item
                   className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center gap-2"
                   onClick={() => setExpandAll(true)}
                 >
                   <UnfoldVertical size={14} />
                   展开全部
                 </DropdownMenu.Item>
                 <DropdownMenu.Item
                   className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center gap-2"
                   onClick={() => setExpandAll(false)}
                 >
                   <FoldVertical size={14} />
                   折叠全部
                 </DropdownMenu.Item>
                 <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                 <DropdownMenu.Item
                   className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center gap-2"
                   onClick={() => setExpandAll(null)}
                 >
                   <RotateCw size={14} />
                   重置状态
                 </DropdownMenu.Item>
               </DropdownMenu.Content>
             </DropdownMenu.Portal>
           </DropdownMenu.Root>

           <button
             onClick={() => fileStore.loadFileTree()}
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="刷新"
           >
             <RotateCw size={16} className={fileStore.isLoading ? "animate-spin" : ""} />
           </button>
           <button
             onClick={() => uiStore.resetProject()}
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="切换项目"
           >
             <Home size={16} />
           </button>
           <button
             onClick={() => fileStore.createFile(fileStore.rootPath, 'New Note.md')}
             className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded transition-colors"
             title="新建笔记"
           >
             <Plus size={16} />
           </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
            value={fileStore.searchQuery}
            onChange={(e) => fileStore.setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar min-w-0">
        {fileStore.searchQuery ? (
          // 显示搜索结果
          fileStore.isSearching ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="ml-2 text-sm text-gray-500">搜索中...</span>
            </div>
          ) : fileStore.searchResults.length === 0 ? (
            <div className="text-center text-xs text-gray-400 mt-10 px-2">
              未找到匹配内容
            </div>
          ) : (
            <>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                内容搜索 ({fileStore.searchResults.length} 个文件)
              </div>
              {fileStore.searchResults.map((result, idx) => (
                <SearchResultItem key={idx} result={result} />
              ))}
            </>
          )
        ) : (
          // 显示文件树
          fileStore.filteredFiles.length === 0 && !fileStore.isLoading ? (
            <div className="text-center text-xs text-gray-400 mt-10 px-2">
              暂无文件
            </div>
          ) : (
            <ExpandContext.Provider value={{ expandAll, setExpandAll }}>
              {fileStore.filteredFiles.map(node => (
                <FileTreeItem key={node.id} node={node} level={0} />
              ))}
            </ExpandContext.Provider>
          )
        )}
      </div>

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        isOpen={fileStore.exportDialog.isOpen}
        title={fileStore.exportDialog.title}
        currentFile={fileStore.exportDialog.currentFile}
        totalProgress={fileStore.exportDialog.totalProgress}
        items={fileStore.exportDialog.items}
        status={fileStore.exportDialog.status}
        completedCount={fileStore.exportDialog.completedCount}
        totalCount={fileStore.exportDialog.totalCount}
        onClose={fileStore.closeExportDialog.bind(fileStore)}
      />
    </div>
  );
});

export default Sidebar;
