
import React, { useCallback } from 'react';
import { CodeFile } from '../types';

interface FileUploaderProps {
  onFilesLoaded: (files: CodeFile[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesLoaded }) => {
  
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const filesData: CodeFile[] = [];
    // Added .h, .hpp, .cc for full C/C++ support
    const allowedExtensions = ['.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.java', '.cpp', '.c', '.h', '.hpp', '.cc'];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = file.webkitRelativePath || file.name;
      
      // Simple extension filter
      const isAllowed = allowedExtensions.some(ext => path.endsWith(ext));
      if (!isAllowed) continue;

      try {
        const content = await file.text();
        filesData.push({
          name: file.name,
          path: path,
          content: content
        });
      } catch (err) {
        console.warn(`Failed to read file ${file.name}`, err);
      }
    }

    onFilesLoaded(filesData);
  }, [onFilesLoaded]);

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/50 hover:bg-slate-800/50 transition-all group cursor-pointer relative">
      <input
        type="file"
        multiple
        // @ts-ignore: webkitdirectory is non-standard but supported in most modern browsers
        webkitdirectory="" 
        directory=""
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="text-center space-y-4 pointer-events-none">
        <div className="w-16 h-16 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-200">Select Project Directory</p>
          <p className="text-sm text-slate-400">Supports Python, JS, TS, Java, C/C++, etc.</p>
        </div>
      </div>
    </div>
  );
};
