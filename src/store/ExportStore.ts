import { makeAutoObservable, runInAction } from 'mobx';

export interface ExportProgressItem {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export type ExportFormat = 'md' | 'html' | 'pdf';
export type ExportStatus = 'exporting' | 'completed' | 'error';

export interface ExportDialogState {
  isOpen: boolean;
  title: string;
  currentFile?: string;
  totalProgress: number;
  items: ExportProgressItem[];
  status: ExportStatus;
  completedCount: number;
  totalCount: number;
}

export class ExportStore {
  exportDialog: ExportDialogState = {
    isOpen: false,
    title: '导出',
    totalProgress: 0,
    items: [],
    status: 'exporting',
    completedCount: 0,
    totalCount: 0
  };

  constructor() {
    makeAutoObservable(this);
  }

  // Initialize export dialog for batch export
  initializeExport(format: ExportFormat, files: Array<{ name: string }>) {
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
  }

  // Update progress for a specific file
  updateItemProgress(index: number, fileName: string, status: ExportProgressItem['status'], error?: string) {
    runInAction(() => {
      const item = this.exportDialog.items[index];
      if (item) {
        item.fileName = fileName;
        item.status = status;
        if (error) item.error = error;
      }
    });
  }

  // Update overall progress
  updateProgress(completedCount: number, totalProgress: number) {
    runInAction(() => {
      this.exportDialog.completedCount = completedCount;
      this.exportDialog.totalProgress = totalProgress;
    });
  }

  // Set current file being exported
  setCurrentFile(fileName: string) {
    runInAction(() => {
      this.exportDialog.currentFile = fileName;
    });
  }

  // Mark export as completed
  markAsCompleted() {
    runInAction(() => {
      this.exportDialog.status = 'completed';
      this.exportDialog.totalProgress = 100;
    });
  }

  // Mark export as error
  markAsError() {
    runInAction(() => {
      this.exportDialog.status = 'error';
    });
  }

  // Close export dialog
  closeDialog() {
    runInAction(() => {
      this.exportDialog.isOpen = false;
    });
  }

  // Reset dialog state
  reset() {
    runInAction(() => {
      this.exportDialog = {
        isOpen: false,
        title: '导出',
        totalProgress: 0,
        items: [],
        status: 'exporting',
        completedCount: 0,
        totalCount: 0
      };
    });
  }
}
