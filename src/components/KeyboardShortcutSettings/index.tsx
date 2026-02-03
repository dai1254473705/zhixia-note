import { observer } from 'mobx-react-lite';
import { useStore } from '../../store';
import { Keyboard, RotateCcw, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { ShortcutConfig } from '../../store/KeyboardShortcutStore';

interface ShortcutRecorderProps {
  shortcut: ShortcutConfig;
  onRecord: (key: string, modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[]) => void;
  onCancel: () => void;
}

const ShortcutRecorder = ({ onRecord, onCancel }: ShortcutRecorderProps) => {
  const [recording, setRecording] = useState(true);
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[] = [];
      if (e.metaKey) modifiers.push('meta');
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.shiftKey) modifiers.push('shift');
      if (e.altKey) modifiers.push('alt');

      // Don't accept modifier-only combinations
      if (!e.key || ['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        setPressedKeys(modifiers);
        return;
      }

      const key = e.key.toLowerCase();
      setRecording(false);
      onRecord(key, modifiers);
    };

    const handleKeyUp = () => {
      // Optional: clear pressed keys visualization
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [recording, onRecord]);

  useEffect(() => {
    if (!recording) {
      const timer = setTimeout(onCancel, 2000);
      return () => clearTimeout(timer);
    }
  }, [recording, onCancel]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 dark:bg-primary/20 border border-primary rounded-md animate-pulse">
      <Keyboard size={16} className="text-primary" />
      <span className="text-sm text-primary font-medium">
        {recording ? '按下快捷键组合...' : '已记录!'}
      </span>
      {pressedKeys.length > 0 && (
        <span className="text-xs text-gray-500 ml-2">
          {pressedKeys.join(' + ')}
        </span>
      )}
      <button
        onClick={onCancel}
        className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
      >
        <X size={14} />
      </button>
    </div>
  );
};

interface ShortcutRowProps {
  shortcut: ShortcutConfig;
  isRecording: boolean;
  onStartRecord: () => void;
  onReset: () => void;
}

const ShortcutRow = observer(({ shortcut, isRecording, onStartRecord, onReset }: ShortcutRowProps) => {
  const { keyboardShortcutStore } = useStore();

  const handleRecord = useCallback((key: string, modifiers: ('meta' | 'ctrl' | 'shift' | 'alt')[]) => {
    keyboardShortcutStore.setShortcut(shortcut.id, key, modifiers);
  }, [shortcut.id, keyboardShortcutStore]);

  const handleCancel = useCallback(() => {
    keyboardShortcutStore.stopRecording();
  }, [keyboardShortcutStore]);

  if (isRecording) {
    return (
      <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg">
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-gray-100">{shortcut.name}</div>
          <div className="text-sm text-gray-500">{shortcut.description}</div>
        </div>
        <ShortcutRecorder
          shortcut={shortcut}
          onRecord={handleRecord}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  const activeShortcut = keyboardShortcutStore.getActiveShortcut(shortcut.id);

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-gray-100">{shortcut.name}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{shortcut.description}</div>
      </div>
      <div className="flex items-center gap-3">
        <kbd className="px-3 py-1.5 text-sm font-mono bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm">
          {activeShortcut}
        </kbd>
        <button
          onClick={onStartRecord}
          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
          title="自定义快捷键"
        >
          <Keyboard size={16} />
        </button>
        {shortcut.customKey && (
          <button
            onClick={onReset}
            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors"
            title="重置为默认"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

export const KeyboardShortcutSettings = observer(() => {
  const { keyboardShortcutStore } = useStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleStartRecord = (id: string) => {
    if (recordingId) {
      keyboardShortcutStore.stopRecording();
    }
    setRecordingId(id);
    keyboardShortcutStore.startRecording(id);
  };

  const handleReset = (id: string) => {
    keyboardShortcutStore.resetShortcut(id);
  };

  const categories: Array<{ key: ShortcutConfig['category']; name: string }> = [
    { key: 'editor', name: '编辑器' },
    { key: 'file', name: '文件操作' },
    { key: 'view', name: '视图' },
    { key: 'navigation', name: '导航' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">快捷键设置</h3>
          <p className="text-sm text-gray-500 mt-1">自定义键盘快捷键以提升工作效率</p>
        </div>
        <button
          onClick={() => keyboardShortcutStore.resetAll()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        >
          <RotateCcw size={14} />
          重置全部
        </button>
      </div>

      {/* Shortcuts by category */}
      {categories.map(category => {
        const shortcuts = keyboardShortcutStore.getShortcutsByCategory(category.key);
        if (shortcuts.length === 0) return null;

        return (
          <div key={category.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{category.name}</h4>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {shortcuts.map(shortcut => (
                <ShortcutRow
                  key={shortcut.id}
                  shortcut={shortcut}
                  isRecording={recordingId === shortcut.id}
                  onStartRecord={() => handleStartRecord(shortcut.id)}
                  onReset={() => handleReset(shortcut.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Help text */}
      <div className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">使用提示:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-400">
          <li>点击键盘图标开始录制新的快捷键</li>
          <li>按下你想使用的组合键 (如 Cmd+S, Ctrl+Shift+B)</li>
          <li>点击重置图标可以恢复默认快捷键</li>
        </ul>
      </div>
    </div>
  );
});
