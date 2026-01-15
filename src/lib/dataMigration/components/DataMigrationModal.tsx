// src/lib/dataMigration/components/DataMigrationModal.tsx

"use client";

import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from "react";
import axios from "axios";
import JSZip from "jszip";
import TabbedModal from "@/components/Overlays/TabbedModal";
import { Button } from "@/components/Form/Button/Button";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import type { ExportField } from "./ExportSettingsModal";

type ChunkResult = {
  chunkName: string;
  success: boolean;
  recordCount: number;
  error?: string;
};

type ImportResultData = {
  totalRecords: number;
  successfulChunks: number;
  failedChunks: number;
  chunkResults: ChunkResult[];
};

type ImportProgress = {
  currentChunk: number;
  totalChunks: number;
  currentChunkName: string;
};

export type DataMigrationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ドメイン名（API 呼び出し用） */
  domain: string;
  /** フィールド情報 */
  fields: ExportField[];
  /** ドメインの表示名 */
  domainLabel: string;
  /** 検索パラメータ（URL クエリ文字列形式） */
  searchParams?: string;
  /** インポート成功時のコールバック */
  onImportSuccess?: () => void;
};

/**
 * エクスポートタブのコンテンツ
 */
function ExportTabContent({
  domain,
  fields,
  searchParams,
  onOpenChange,
}: {
  domain: string;
  fields: ExportField[];
  searchParams?: string;
  onOpenChange: (open: boolean) => void;
}) {
  // システムフィールド
  const systemFields: ExportField[] = [
    { name: "id", label: "ID" },
    { name: "createdAt", label: "作成日時" },
    { name: "updatedAt", label: "更新日時" },
    { name: "deletedAt", label: "削除日時" },
  ];

  const allFields = [...systemFields.slice(0, 1), ...fields, ...systemFields.slice(1)];
  const allFieldNames = allFields.map((f) => f.name);

  // 画像フィールドを抽出
  const imageFieldNames = fields.filter((f) => f.isImageField).map((f) => f.name);

  const [selectedFields, setSelectedFields] = useState<string[]>(allFieldNames);
  const [includeImages, setIncludeImages] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllSelected = selectedFields.length === allFieldNames.length;
  const isNoneSelected = selectedFields.length === 0;

  const handleSelectAll = useCallback(() => {
    setSelectedFields(allFieldNames);
  }, [allFieldNames]);

  const handleDeselectAll = useCallback(() => {
    setSelectedFields([]);
  }, []);

  const handleToggleField = useCallback((fieldName: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]
    );
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await axios.post(
        "/api/data-migration/export",
        {
          domain,
          selectedFields,
          includeImages,
          searchParams,
          imageFields: includeImages ? imageFieldNames : [],
        },
        {
          responseType: "blob",
        }
      );

      // ファイル名をヘッダーから取得
      const contentDisposition = response.headers["content-disposition"];
      let filename = `${domain}_export.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Blob をダウンロード
      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (err) {
      console.error("Export failed:", err);
      if (axios.isAxiosError(err) && err.response?.data) {
        // Blob を JSON に変換してエラーメッセージを取得
        const blob = err.response.data as Blob;
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          setError(json.error || "エクスポートに失敗しました");
        } catch {
          setError("エクスポートに失敗しました");
        }
      } else {
        setError("エクスポートに失敗しました");
      }
    } finally {
      setIsExporting(false);
    }
  }, [domain, selectedFields, includeImages, searchParams, imageFieldNames, onOpenChange]);

  return (
    <Block className="p-4">
      {/* 画像オプション */}
      <Block className="mb-4 pb-4 border-b border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={includeImages}
            onCheckedChange={(checked) => setIncludeImages(checked === true)}
          />
          <span className="text-sm">画像を含める（ZIP形式でダウンロード）</span>
        </label>
      </Block>

      {/* カラム選択 */}
      <Block className="mb-4">
        <Flex justify="between" align="center" className="mb-3">
          <span className="text-sm font-medium">エクスポートするカラム</span>
          <Flex gap="sm">
            <Button size="xs" variant="outline" onClick={handleSelectAll} disabled={isAllSelected}>
              全選択
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={handleDeselectAll}
              disabled={isNoneSelected}
            >
              全解除
            </Button>
          </Flex>
        </Flex>

        <Block className="space-y-2 max-h-64 overflow-y-auto">
          {allFields.map((field) => (
            <label key={field.name} className="flex items-center gap-2 cursor-pointer py-1">
              <Checkbox
                checked={selectedFields.includes(field.name)}
                onCheckedChange={() => handleToggleField(field.name)}
              />
              <span className="text-sm">
                {field.label}
                <span className="text-muted-foreground ml-1">({field.name})</span>
              </span>
            </label>
          ))}
        </Block>
      </Block>

      {/* エラー表示 */}
      {error && (
        <Block className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
          {error}
        </Block>
      )}

      {/* フッター */}
      <Flex justify="end" gap="sm" className="pt-4 border-t border-border">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
          キャンセル
        </Button>
        <Button onClick={handleExport} disabled={isNoneSelected || isExporting}>
          {isExporting ? "エクスポート中..." : "エクスポート"}
        </Button>
      </Flex>
    </Block>
  );
}

/**
 * インポートタブのコンテンツ
 */
function ImportTabContent({
  domain,
  imageFields,
  fields,
  onOpenChange,
  onImportSuccess,
}: {
  domain: string;
  imageFields: string[];
  fields: ExportField[];
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // インポート中の画面遷移警告
  useEffect(() => {
    if (!isImporting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "インポート処理中です。ページを離れると処理が中断されます。";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isImporting]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setResult(null);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".zip")) {
      setSelectedFile(file);
    } else {
      setError("ZIPファイルを選択してください");
    }
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);

    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".zip")) {
      setSelectedFile(file);
    } else if (file) {
      setError("ZIPファイルを選択してください");
    }
  }, []);

  const handleClickSelectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      // ZIP をブラウザ上で解凍
      const arrayBuffer = await selectedFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // manifest.json を読み込み
      const manifestFile = zip.file("manifest.json");
      if (!manifestFile) {
        throw new Error("manifest.json が見つかりません");
      }
      const manifestText = await manifestFile.async("string");
      const manifest = JSON.parse(manifestText) as {
        domain: string;
        totalRecords: number;
        chunkCount: number;
      };

      // ドメイン検証
      if (manifest.domain !== domain) {
        throw new Error(`ドメインが一致しません: ${manifest.domain} !== ${domain}`);
      }

      // フィールド型情報を準備
      const fieldTypeInfo = fields.map((f) => ({
        name: f.name,
        fieldType: f.fieldType,
      }));

      // チャンクを順番に処理
      const chunkResults: ChunkResult[] = [];
      let totalRecords = 0;
      let successfulChunks = 0;
      let failedChunks = 0;

      for (let i = 0; i < manifest.chunkCount; i++) {
        const chunkName = `chunk_${String(i + 1).padStart(3, "0")}`;
        setProgress({
          currentChunk: i + 1,
          totalChunks: manifest.chunkCount,
          currentChunkName: chunkName,
        });

        // CSV ファイルを取得
        const csvFile = zip.file(`${chunkName}/data.csv`);
        if (!csvFile) {
          chunkResults.push({
            chunkName,
            success: false,
            recordCount: 0,
            error: "data.csv が見つかりません",
          });
          failedChunks++;
          continue;
        }
        const csvContent = await csvFile.async("string");

        // FormData を作成
        const formData = new FormData();
        formData.append("domain", domain);
        formData.append("chunkName", chunkName);
        formData.append("csvContent", csvContent);
        formData.append("imageFields", JSON.stringify(imageFields));
        formData.append("updateImages", "true");
        formData.append("fields", JSON.stringify(fieldTypeInfo));

        // アセットファイルを追加
        const assetsFolder = zip.folder(`${chunkName}/assets`);
        if (assetsFolder) {
          const assetFiles = assetsFolder.filter(() => true);
          for (const assetFile of assetFiles) {
            if (assetFile.dir) continue;
            const assetBuffer = await assetFile.async("arraybuffer");
            // パスから chunk_xxx/assets/ を除去
            const assetPath = assetFile.name.replace(`${chunkName}/assets/`, "");
            const blob = new Blob([assetBuffer]);
            formData.append(`asset:${assetPath}`, blob, assetPath.split("/").pop());
          }
        }

        // チャンクを送信
        try {
          const response = await axios.post("/api/data-migration/import-chunk", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          const data = response.data as { chunkName: string; recordCount: number };
          chunkResults.push({
            chunkName: data.chunkName,
            success: true,
            recordCount: data.recordCount,
          });
          totalRecords += data.recordCount;
          successfulChunks++;
        } catch (err) {
          const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
            ? err.response.data.error
            : "Unknown error";
          chunkResults.push({
            chunkName,
            success: false,
            recordCount: 0,
            error: errorMsg,
          });
          failedChunks++;
        }
      }

      setResult({
        totalRecords,
        successfulChunks,
        failedChunks,
        chunkResults,
      });

      // インポート成功時にコールバック
      if (successfulChunks > 0 && onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      console.error("Import failed:", err);
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  }, [selectedFile, domain, imageFields, fields, onImportSuccess]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Block className="p-4">
      {/* ファイル選択エリア */}
      {!selectedFile && !result && !isImporting && (
        <Block
          className={`mb-4 p-8 border-2 border-dashed rounded-lg text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="text-muted-foreground mb-2">ZIPファイルをドラッグ＆ドロップ</p>
          <p className="text-muted-foreground text-sm">または</p>
          <Button variant="outline" className="mt-2" onClick={handleClickSelectFile}>
            ファイルを選択
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileSelect}
          />
        </Block>
      )}

      {/* 選択されたファイル表示 */}
      {selectedFile && !result && !isImporting && (
        <Block className="mb-4 p-4 bg-muted/30 rounded-lg">
          <Flex justify="between" align="center">
            <Block>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </Block>
            <Button variant="ghost" size="sm" onClick={handleClearFile}>
              取り消し
            </Button>
          </Flex>
        </Block>
      )}

      {/* インポート進捗 */}
      {isImporting && progress && (
        <Block className="mb-4">
          <Block className="p-4 bg-primary/5 rounded-lg">
            <Flex justify="between" align="center" className="mb-2">
              <p className="text-sm font-medium">インポート中...</p>
              <p className="text-sm text-muted-foreground">
                {progress.currentChunk} / {progress.totalChunks}
              </p>
            </Flex>
            {/* 進捗バー */}
            <Block className="h-2 bg-muted rounded-full overflow-hidden">
              <Block
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(progress.currentChunk / progress.totalChunks) * 100}%`,
                }}
              />
            </Block>
            <p className="text-xs text-muted-foreground mt-2">
              処理中: {progress.currentChunkName}
            </p>
          </Block>
          <Block className="mt-3 p-3 bg-amber-500/10 rounded text-sm text-amber-700">
            インポート中はページを閉じないでください
          </Block>
        </Block>
      )}

      {/* インポート結果 */}
      {result && (
        <Block className="mb-4">
          <Block
            className={`p-4 rounded-lg ${
              result.failedChunks === 0 ? "bg-emerald-500/10" : "bg-amber-500/10"
            }`}
          >
            <p className="font-medium mb-2">
              {result.failedChunks === 0 ? "インポート完了" : "インポート完了（一部エラー）"}
            </p>
            <Block className="text-sm space-y-1">
              <p>インポートされたレコード: {result.totalRecords}件</p>
              <p>成功したチャンク: {result.successfulChunks}</p>
              {result.failedChunks > 0 && (
                <p className="text-destructive">失敗したチャンク: {result.failedChunks}</p>
              )}
            </Block>
          </Block>

          {/* 失敗したチャンクの詳細 */}
          {result.chunkResults.some((c) => !c.success) && (
            <Block className="mt-3 p-3 bg-destructive/10 rounded text-sm">
              <p className="font-medium mb-1">エラー詳細:</p>
              {result.chunkResults
                .filter((c) => !c.success)
                .map((c) => (
                  <p key={c.chunkName} className="text-destructive">
                    {c.chunkName}: {c.error}
                  </p>
                ))}
            </Block>
          )}
        </Block>
      )}

      {/* エラー表示 */}
      {error && (
        <Block className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
          {error}
        </Block>
      )}

      {/* フッター */}
      <Flex justify="end" gap="sm" className="pt-4 border-t border-border">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
          {result ? "閉じる" : "キャンセル"}
        </Button>
        {!result && !isImporting && (
          <Button onClick={handleImport} disabled={!selectedFile}>
            インポート
          </Button>
        )}
        {result && (
          <Button
            onClick={() => {
              setResult(null);
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
          >
            別のファイルをインポート
          </Button>
        )}
      </Flex>
    </Block>
  );
}

/**
 * データ移行（エクスポート/インポート）モーダル
 */
export function DataMigrationModal({
  open,
  onOpenChange,
  domain,
  fields,
  domainLabel,
  searchParams,
  onImportSuccess,
}: DataMigrationModalProps) {
  // 画像フィールドを抽出
  const imageFieldNames = fields.filter((f) => f.isImageField).map((f) => f.name);

  const tabs = [
    {
      value: "export",
      label: "エクスポート",
      content: (
        <ExportTabContent
          domain={domain}
          fields={fields}
          searchParams={searchParams}
          onOpenChange={onOpenChange}
        />
      ),
    },
    {
      value: "import",
      label: "インポート",
      content: (
        <ImportTabContent
          domain={domain}
          imageFields={imageFieldNames}
          fields={fields}
          onOpenChange={onOpenChange}
          onImportSuccess={onImportSuccess}
        />
      ),
    },
  ];

  return (
    <TabbedModal
      open={open}
      onOpenChange={onOpenChange}
      title={`${domainLabel}のファイル入出力`}
      maxWidth={480}
      maxHeight="80vh"
      tabs={tabs}
      ariaLabel="エクスポート・インポートの切り替え"
    />
  );
}

export default DataMigrationModal;
