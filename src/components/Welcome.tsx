import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Github, FolderPlus, FolderOpen, Loader2, ArrowLeft } from 'lucide-react';
import logo from '../assets/zhixia-logo.svg';

export const Welcome = observer(() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'menu' | 'clone'>('menu');
  const [repoUrl, setRepoUrl] = useState('');
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [logPath, setLogPath] = useState('');

  useEffect(() => {
    // Load recent projects on mount
    const loadRecent = async () => {
      try {
        const res = await window.electronAPI.getConfig();
        console.log('Welcome: Loaded config', res);
        if (res.success && res.data?.recentProjects) {
          console.log('Welcome: Setting recent projects', res.data.recentProjects);
          setRecentProjects(res.data.recentProjects);
        }
        
        // Load Log Path
        const logRes = await window.electronAPI.getLogPath();
        if (logRes.success && logRes.data) {
          setLogPath(logRes.data);
        }
      } catch (e) {
        console.error('Failed to load recent projects', e);
      }
    };
    loadRecent();
  }, []);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setLoading(true);
      setError('');
      await action();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  const openLocal = () => handleAction(async () => {
    const { data } = await window.electronAPI.openDirectory();
    if (!data?.canceled && data?.filePaths?.[0]) {
      await window.electronAPI.setProject(data.filePaths[0]);
    } else {
      throw new Error('Operation cancelled');
    }
  });

  const createLocal = () => handleAction(async () => {
    const { data } = await window.electronAPI.openDirectory();
    if (!data?.canceled && data?.filePaths?.[0]) {
      const path = data.filePaths[0];
      await window.electronAPI.initGit(path);
      await window.electronAPI.setProject(path);
    } else {
      throw new Error('Operation cancelled');
    }
  });

  const cloneRepo = () => handleAction(async () => {
    if (!repoUrl) return;
    const { data } = await window.electronAPI.openDirectory();
    if (!data?.canceled && data?.filePaths?.[0]) {
      const parentPath = data.filePaths[0];
      // Clone returns the final path (parentPath/repoName)
      const res = await window.electronAPI.cloneGit(repoUrl, parentPath);
      if (res.success && res.data) {
        // Project is already set and added to recent in backend during clone
        // But we call setProject again to trigger UI refresh if needed, although backend handles config save.
        // Actually, let's just use the setProject to be safe and consistent, 
        // as it might do other things in future (like init Git service state).
        await window.electronAPI.setProject(res.data);
      } else {
        throw new Error(res.error || 'Clone failed');
      }
    } else {
      throw new Error('Operation cancelled');
    }
  });

  if (mode === 'clone') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setMode('menu')}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold">Clone from GitHub</h1>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Repository URL</label>
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo.git"
                className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <button
              onClick={cloneRepo}
              disabled={loading || !repoUrl}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Github className="w-5 h-5" />}
              <span>Clone Repository</span>
            </button>
            
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-8">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-4 flex flex-col items-center">
          <img src={logo} alt="Logo" className="w-24 h-24 mb-4" />
          <h1 className="text-4xl font-bold tracking-tight">Welcome to 知夏笔记</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400">
            A local-first, GitHub-synced Markdown notebook
          </p>
        </div>

        {logPath && (
          <div className="w-full bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-center">
             <p className="text-sm text-blue-800 dark:text-blue-300">
               <span className="font-semibold">Log File:</span> {logPath}
             </p>
             <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
               Press <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border rounded shadow-sm">F12</kbd> or <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border rounded shadow-sm">Cmd/Ctrl + Shift + I</kbd> to toggle Developer Tools
             </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button
            onClick={() => setMode('clone')}
            disabled={loading}
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all text-left space-y-4"
          >
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
              <Github className="w-8 h-8 text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Clone from GitHub</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Download an existing repository from GitHub and start editing.
              </p>
            </div>
          </button>

          <button
            onClick={createLocal}
            disabled={loading}
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all text-left space-y-4"
          >
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit group-hover:bg-green-100 dark:group-hover:bg-green-900 transition-colors">
              <FolderPlus className="w-8 h-8 text-gray-700 dark:text-gray-200 group-hover:text-green-600 dark:group-hover:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Create New Project</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Initialize a new local Git repository in an empty folder.
              </p>
            </div>
          </button>

          <button
            onClick={openLocal}
            disabled={loading}
            className="group p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 transition-all text-left space-y-4"
          >
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit group-hover:bg-purple-100 dark:group-hover:bg-purple-900 transition-colors">
              <FolderOpen className="w-8 h-8 text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Open Local Folder</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Open an existing local folder or Git repository.
              </p>
            </div>
          </button>
        </div>

        {/* Recent Projects Section */}
        <div className="w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center justify-between">
            <span>Recent Projects</span>
            <span className="text-xs font-normal text-gray-400">
              {recentProjects.length} items
            </span>
          </h2>
          
          {recentProjects.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {recentProjects.map((path) => (
                <button
                  key={path}
                  onClick={() => handleAction(async () => { await window.electronAPI.setProject(path); })}
                  disabled={loading}
                  className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-colors group text-left w-full shadow-sm"
                >
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md mr-4 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors">
                    <FolderOpen className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-primary dark:group-hover:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {path.split('/').pop()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate opacity-70" title={path}>
                      {path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No recent projects found</p>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Processing...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
});
