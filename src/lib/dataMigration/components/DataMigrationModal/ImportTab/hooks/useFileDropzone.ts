// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/useFileDropzone.ts
// ファイルドロップゾーンの状態管理フック

"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";

export type UseFileDropzoneOptions = {
  /** 許可するファイル拡張子（例: ".zip"） */
  acceptExtension?: string;
  /** エラーメッセージ */
  errorMessage?: string;
};

export type UseFileDropzoneReturn = {
  /** 選択されたファイル */
  selectedFile: File | null;
  /** ドラッグ中フラグ */
  isDragging: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** ファイル入力の ref */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** ドラッグオーバーハンドラ */
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
  /** ドラッグリーブハンドラ */
  handleDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  /** ドロップハンドラ */
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  /** ファイル選択ハンドラ */
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  /** ファイル選択ボタンクリックハンドラ */
  handleClickSelectFile: () => void;
  /** ファイルクリアハンドラ */
  handleClearFile: () => void;
  /** エラーをクリア */
  clearError: () => void;
  /** ファイルを設定（外部から） */
  setSelectedFile: (file: File | null) => void;
  /** エラーを設定（外部から） */
  setError: (error: string | null) => void;
};

/**
 * ファイルドロップゾーンの状態管理フック
 */
export function useFileDropzone({
  acceptExtension = ".zip",
  errorMessage = "ZIPファイルを選択してください",
}: UseFileDropzoneOptions = {}): UseFileDropzoneReturn {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): boolean => {
      return file.name.endsWith(acceptExtension);
    },
    [acceptExtension]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        setSelectedFile(file);
      } else {
        setError(errorMessage);
      }
    },
    [validateFile, errorMessage]
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setError(null);

      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        setSelectedFile(file);
      } else if (file) {
        setError(errorMessage);
      }
    },
    [validateFile, errorMessage]
  );

  const handleClickSelectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    selectedFile,
    isDragging,
    error,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleClickSelectFile,
    handleClearFile,
    clearError,
    setSelectedFile,
    setError,
  };
}
