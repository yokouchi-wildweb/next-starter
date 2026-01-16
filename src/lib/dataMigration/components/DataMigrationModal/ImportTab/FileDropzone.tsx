// src/lib/dataMigration/components/DataMigrationModal/ImportTab/FileDropzone.tsx
// ファイルドロップゾーンコンポーネント

"use client";

import type { DragEvent, ChangeEvent, RefObject } from "react";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";

export type FileDropzoneProps = {
  /** 選択されたファイル */
  selectedFile: File | null;
  /** ドラッグ中フラグ */
  isDragging: boolean;
  /** ファイル入力の ref */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** ドラッグオーバーハンドラ */
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  /** ドラッグリーブハンドラ */
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  /** ドロップハンドラ */
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  /** ファイル選択ハンドラ */
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  /** ファイル選択ボタンクリックハンドラ */
  onClickSelectFile: () => void;
  /** ファイルクリアハンドラ */
  onClearFile: () => void;
};

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ファイルドロップゾーンコンポーネント
 */
export function FileDropzone({
  selectedFile,
  isDragging,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onClickSelectFile,
  onClearFile,
}: FileDropzoneProps) {
  // ファイルが選択されている場合
  if (selectedFile) {
    return (
      <Block className="mb-4 p-4 bg-muted/30 rounded-lg">
        <Flex justify="between" align="center">
          <Block>
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
          </Block>
          <Button variant="ghost" size="sm" onClick={onClearFile}>
            取り消し
          </Button>
        </Flex>
      </Block>
    );
  }

  // ドロップゾーン表示
  return (
    <Block
      className={`mb-4 p-8 border-2 border-dashed rounded-lg text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <p className="text-muted-foreground mb-2">ZIPファイルをドラッグ＆ドロップ</p>
      <p className="text-muted-foreground text-sm">または</p>
      <Button variant="outline" className="mt-2" onClick={onClickSelectFile}>
        ファイルを選択
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={onFileSelect}
      />
    </Block>
  );
}
