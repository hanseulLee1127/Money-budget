'use client';

import { useState, useCallback, useRef } from 'react';

interface PdfUploadProps {
  onUploadComplete: (text: string) => void;
  onError: (error: string) => void;
}

export default function PdfUpload({ onUploadComplete, onError }: PdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isCsv = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');

    if (!isPdf && !isCsv) {
      onError('Please upload a PDF or CSV file');
      return;
    }

    // 파일 크기 확인 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError('File size must be less than 10MB');
      return;
    }

    setFileName(file.name);
    setIsUploading(true);

    try {
      if (isCsv) {
        // CSV: 클라이언트에서 직접 텍스트로 읽어서 AI에 전달
        const text = await file.text();
        if (!text || text.trim().length === 0) {
          onError('CSV file is empty');
          setFileName(null);
          return;
        }
        onUploadComplete(text);
      } else {
        // PDF: 서버에서 파싱
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          onError(result.error || 'Failed to extract PDF text');
          setFileName(null);
          return;
        }

        onUploadComplete(result.data.text);
      }
    } catch {
      onError('Failed to upload file. Please try again.');
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }
        ${isUploading ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-blue-600 mb-4"></div>
          <p className="text-lg font-medium text-slate-700">Processing {fileName}...</p>
          <p className="text-sm text-slate-500 mt-2">Extracting transactions from your file</p>
        </div>
      ) : (
        <>
          {/* 아이콘 */}
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {/* 텍스트 */}
          <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-2">
            Upload Transaction History
          </h3>
          <p className="text-sm sm:text-base text-slate-400 mb-4 px-2">
            Drag and drop your card statement PDF or card transaction history CSV here, or click to browse
          </p>

          {/* 버튼 */}
          <button
            type="button"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
          >
            Select File
          </button>

          {/* 힌트 */}
          <p className="text-xs text-slate-400 mt-4">
            Supported formats: PDF, CSV (max 10MB)
          </p>
        </>
      )}
    </div>
  );
}
