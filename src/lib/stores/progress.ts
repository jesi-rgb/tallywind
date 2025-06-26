import { writable } from 'svelte/store';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error';

export type FileProgress = {
  path: string;
  status: FileStatus;
  size?: number;
  classesFound?: number;
  error?: string;
};

export type AnalysisProgress = {
  repoUrl: string;
  status: 'fetching' | 'parsing' | 'analyzing' | 'saving' | 'completed';
  filesProcessed?: number;
  totalFiles?: number;
  currentFile?: string;
  files?: FileProgress[];
  error?: string;
};

// Create a writable store with initial empty state
export const analysisProgress = writable<AnalysisProgress | null>(null);

// Helper functions to update progress
export function startAnalysis(repoUrl: string) {
  analysisProgress.set({
    repoUrl,
    status: 'fetching'
  });
}

export function updateProgress(progress: Partial<AnalysisProgress>) {
  analysisProgress.update(current => {
    if (!current) return null;
    return { ...current, ...progress };
  });
}

export function completeAnalysis() {
  analysisProgress.update(current => {
    if (!current) return null;
    return { ...current, status: 'completed' };
  });
}

export function setAnalysisError(error: string) {
  analysisProgress.update(current => {
    if (!current) return null;
    return { ...current, error, status: 'completed' };
  });
}

export function resetProgress() {
  analysisProgress.set(null);
}

export function initializeFiles(filePaths: string[]) {
  analysisProgress.update(current => {
    if (!current) return null;
    const files: FileProgress[] = filePaths.map(path => ({
      path,
      status: 'pending' as FileStatus
    }));
    return { ...current, files, totalFiles: filePaths.length };
  });
}

export function updateFileStatus(filePath: string, status: FileStatus, data?: Partial<FileProgress>) {
  analysisProgress.update(current => {
    if (!current || !current.files) return current;
    
    const files = current.files.map(file => 
      file.path === filePath 
        ? { ...file, status, ...data }
        : file
    );
    
    const filesProcessed = files.filter(f => f.status === 'completed' || f.status === 'error').length;
    
    return { 
      ...current, 
      files, 
      filesProcessed,
      currentFile: status === 'processing' ? filePath : current.currentFile
    };
  });
}