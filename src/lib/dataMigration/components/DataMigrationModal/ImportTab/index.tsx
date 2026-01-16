// src/lib/dataMigration/components/DataMigrationModal/ImportTab/index.tsx
// インポートタブのコンテンツ

"use client";

import { useCallback } from "react";
import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { useFileDropzone, useImportHandler } from "./hooks";
import { FileDropzone } from "./FileDropzone";
import { ImportProgress } from "./ImportProgress";
import { ImportResult } from "./ImportResult";
import type { ImportTabContentProps } from "../types";

/**
 * インポートタブのコンテンツ
 */
export function ImportTab({
  domain,
  imageFields,
  fields,
  onOpenChange,
  onImportSuccess,
}: ImportTabContentProps) {
  // ファイルドロップゾーンの状態管理
  const dropzone = useFileDropzone();

  // インポート処理のロジック
  const importHandler = useImportHandler({
    domain,
    imageFields,
    fields,
    onImportSuccess,
  });

  // インポート実行
  const handleImportClick = useCallback(async () => {
    if (!dropzone.selectedFile) return;
    dropzone.clearError();
    await importHandler.handleImport(dropzone.selectedFile);
  }, [dropzone, importHandler]);

  // 別のファイルをインポート
  const handleImportAnother = useCallback(() => {
    importHandler.resetResult();
    dropzone.handleClearFile();
  }, [importHandler, dropzone]);

  // 表示状態の判定
  const showDropzone = !dropzone.selectedFile && !importHandler.result && !importHandler.isImporting;
  const showSelectedFile = dropzone.selectedFile && !importHandler.result && !importHandler.isImporting;
  const showProgress = importHandler.isImporting && importHandler.progress;
  const showResult = importHandler.result;

  // エラー（dropzone と importHandler の両方をマージ）
  const error = dropzone.error || importHandler.error;

  return (
    <Block className="p-4">
      {/* ファイル選択エリア */}
      {showDropzone && (
        <FileDropzone
          selectedFile={null}
          isDragging={dropzone.isDragging}
          fileInputRef={dropzone.fileInputRef}
          onDragOver={dropzone.handleDragOver}
          onDragLeave={dropzone.handleDragLeave}
          onDrop={dropzone.handleDrop}
          onFileSelect={dropzone.handleFileSelect}
          onClickSelectFile={dropzone.handleClickSelectFile}
          onClearFile={dropzone.handleClearFile}
        />
      )}

      {/* 選択されたファイル表示 */}
      {showSelectedFile && (
        <FileDropzone
          selectedFile={dropzone.selectedFile}
          isDragging={false}
          fileInputRef={dropzone.fileInputRef}
          onDragOver={dropzone.handleDragOver}
          onDragLeave={dropzone.handleDragLeave}
          onDrop={dropzone.handleDrop}
          onFileSelect={dropzone.handleFileSelect}
          onClickSelectFile={dropzone.handleClickSelectFile}
          onClearFile={dropzone.handleClearFile}
        />
      )}

      {/* インポート進捗 */}
      {showProgress && <ImportProgress progress={importHandler.progress!} />}

      {/* インポート結果 */}
      {showResult && <ImportResult result={importHandler.result!} />}

      {/* エラー表示 */}
      {error && (
        <Block className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
          {error}
        </Block>
      )}

      {/* フッター */}
      <Flex justify="end" gap="sm" className="pt-4 border-t border-border">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importHandler.isImporting}>
          {importHandler.result ? "閉じる" : "キャンセル"}
        </Button>
        {!importHandler.result && !importHandler.isImporting && (
          <Button onClick={handleImportClick} disabled={!dropzone.selectedFile}>
            インポート
          </Button>
        )}
        {importHandler.result && (
          <Button onClick={handleImportAnother}>別のファイルをインポート</Button>
        )}
      </Flex>
    </Block>
  );
}
