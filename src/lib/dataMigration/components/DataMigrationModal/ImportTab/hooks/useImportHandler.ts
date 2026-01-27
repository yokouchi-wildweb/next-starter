// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/useImportHandler.ts
// インポート処理のロジックフック

"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import JSZip from "jszip";
import type {
  ChunkResult,
  ImportResultData,
  ImportProgress,
  ManifestV1,
  ManifestV1_1,
  ExportField,
} from "../../types";

export type UseImportHandlerOptions = {
  /** ドメイン名 */
  domain: string;
  /** 画像フィールド名の配列 */
  imageFields: string[];
  /** フィールド情報 */
  fields: ExportField[];
  /** インポート成功時のコールバック */
  onImportSuccess?: () => void;
};

export type UseImportHandlerReturn = {
  /** インポート中フラグ */
  isImporting: boolean;
  /** 進捗状態 */
  progress: ImportProgress | null;
  /** インポート結果 */
  result: ImportResultData | null;
  /** エラーメッセージ */
  error: string | null;
  /** インポート実行 */
  handleImport: (file: File) => Promise<void>;
  /** 結果をリセット */
  resetResult: () => void;
  /** エラーをクリア */
  clearError: () => void;
};

/** デバッグログ出力用のプレフィックス */
const LOG_PREFIX = "[Import]";

/**
 * インポート処理のロジックフック
 */
export function useImportHandler({
  domain,
  imageFields,
  fields,
  onImportSuccess,
}: UseImportHandlerOptions): UseImportHandlerReturn {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  /**
   * 単一ドメインのチャンクを処理
   */
  const processChunksForDomain = useCallback(
    async (
      zip: JSZip,
      domainName: string,
      chunkCount: number,
      chunkPrefix: string,
      domainIndex?: number,
      totalDomains?: number,
      domainType?: "main" | "related" | "junction" | "hasMany"
    ): Promise<{ records: number; successful: number; failed: number; results: ChunkResult[] }> => {
      const results: ChunkResult[] = [];
      let records = 0;
      let successful = 0;
      let failed = 0;

      // ドメイン処理開始ログ
      const domainProgress = totalDomains ? `[${domainIndex}/${totalDomains}]` : "";
      console.log(
        `${LOG_PREFIX} 📦 ドメイン処理開始: ${domainName} ${domainProgress}`,
        { type: domainType, chunkCount, chunkPrefix: chunkPrefix || "(root)" }
      );

      // フィールド型情報を準備（メインドメイン用）
      const fieldTypeInfo = fields.map((f) => ({
        name: f.name,
        fieldType: f.fieldType,
      }));

      for (let i = 0; i < chunkCount; i++) {
        const chunkName = `chunk_${String(i + 1).padStart(3, "0")}`;
        const chunkPath = chunkPrefix ? `${chunkPrefix}/${chunkName}` : chunkName;

        setProgress({
          currentDomain: domainName,
          currentDomainIndex: domainIndex,
          totalDomains: totalDomains,
          currentChunk: i + 1,
          totalChunks: chunkCount,
          currentChunkName: chunkName,
        });

        // チャンク処理開始ログ
        console.log(
          `${LOG_PREFIX}   📄 チャンク処理: ${chunkName} [${i + 1}/${chunkCount}]`,
          { domain: domainName, path: chunkPath }
        );

        // CSV ファイルを取得
        const csvFile = zip.file(`${chunkPath}/data.csv`);
        if (!csvFile) {
          console.error(
            `${LOG_PREFIX}   ❌ チャンク失敗: ${chunkName}`,
            { domain: domainName, error: "data.csv が見つかりません", path: `${chunkPath}/data.csv` }
          );
          results.push({
            chunkName,
            domain: domainName,
            success: false,
            recordCount: 0,
            error: "data.csv が見つかりません",
          });
          failed++;
          continue;
        }
        const csvContent = await csvFile.async("string");

        // FormData を作成
        const formData = new FormData();
        formData.append("domain", domainName);
        formData.append("chunkName", chunkName);
        formData.append("csvContent", csvContent);
        // メインドメイン以外は画像フィールドを空にする
        const domainImageFields = domainName === domain ? imageFields : [];
        formData.append("imageFields", JSON.stringify(domainImageFields));
        formData.append("updateImages", "true");
        // メインドメインのみフィールド型情報を送る
        formData.append("fields", JSON.stringify(domainName === domain ? fieldTypeInfo : []));
        // ドメインタイプを送る
        if (domainType) {
          formData.append("domainType", domainType);
        }

        // アセットファイルを追加
        const assetsFolder = zip.folder(`${chunkPath}/assets`);
        if (assetsFolder) {
          const assetFiles = assetsFolder.filter(() => true);
          if (assetFiles.length > 0) {
            console.log(`${LOG_PREFIX}     🖼️ アセット処理: ${assetFiles.length} ファイル`, {
              path: `${chunkPath}/assets`,
            });
          }
          for (const assetFile of assetFiles) {
            if (assetFile.dir) continue;
            const assetBuffer = await assetFile.async("arraybuffer");
            const assetPath = assetFile.name.replace(`${chunkPath}/assets/`, "");
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
          console.log(
            `${LOG_PREFIX}   ✅ チャンク成功: ${chunkName}`,
            { domain: domainName, recordCount: data.recordCount }
          );
          results.push({
            chunkName: data.chunkName,
            domain: domainName,
            success: true,
            recordCount: data.recordCount,
          });
          records += data.recordCount;
          successful++;
        } catch (err) {
          // エラーメッセージを複数のフィールドから取得を試みる
          const responseData = axios.isAxiosError(err) ? err.response?.data : null;
          const errorMsg =
            responseData?.error ||
            responseData?.message ||
            (axios.isAxiosError(err) ? err.message : null) ||
            (err instanceof Error ? err.message : "Unknown error");
          const errorDetails = axios.isAxiosError(err)
            ? {
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                headers: err.response?.headers,
              }
            : { raw: err };
          console.error(
            `${LOG_PREFIX}   ❌ チャンク失敗: ${chunkName}`,
            { domain: domainName, error: errorMsg }
          );
          console.error(`${LOG_PREFIX}   📋 エラー詳細:`, errorDetails);
          if (responseData) {
            console.error(`${LOG_PREFIX}   📋 サーバーレスポンス:`, JSON.stringify(responseData, null, 2));
          }
          results.push({
            chunkName,
            domain: domainName,
            success: false,
            recordCount: 0,
            error: errorMsg,
          });
          failed++;
        }
      }

      // ドメイン処理完了ログ
      console.log(
        `${LOG_PREFIX} 📦 ドメイン処理完了: ${domainName}`,
        { records, successful, failed }
      );

      return { records, successful, failed, results };
    },
    [domain, fields, imageFields]
  );

  /**
   * インポート実行
   */
  const handleImport = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setError(null);
      setResult(null);
      setProgress(null);

      // インポート開始ログ
      console.log(`${LOG_PREFIX} 🚀 インポート開始`, {
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)} KB`,
        targetDomain: domain,
        imageFields,
        fieldCount: fields.length,
      });

      try {
        // ZIP をブラウザ上で解凍
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        console.log(`${LOG_PREFIX} 📁 ZIP解凍完了`, {
          fileCount: Object.keys(zip.files).length,
        });

        // manifest.json を読み込み
        const manifestFile = zip.file("manifest.json");
        if (!manifestFile) {
          throw new Error("manifest.json が見つかりません");
        }
        const manifestText = await manifestFile.async("string");
        const rawManifest = JSON.parse(manifestText);
        console.log(`${LOG_PREFIX} 📋 マニフェスト読み込み完了`, rawManifest);

        // v1.1（複数ドメイン）の処理
        if (rawManifest.version === "1.1") {
          const manifest = rawManifest as ManifestV1_1;
          console.log(`${LOG_PREFIX} 📦 v1.1 複数ドメインモード`, {
            mainDomain: manifest.mainDomain,
            domainCount: manifest.domains.length,
            domains: manifest.domains.map((d) => `${d.name}(${d.type})`),
          });

          // ドメイン検証（メインドメインのみ）
          if (manifest.mainDomain !== domain) {
            throw new Error(`ドメインが一致しません: ${manifest.mainDomain} !== ${domain}`);
          }

          // インポート順序に従ってソート（related → main → hasMany → junction）
          const typeOrder: Record<string, number> = { related: 1, main: 2, hasMany: 3, junction: 4 };
          const sortedDomains = [...manifest.domains].sort(
            (a, b) => (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
          );
          console.log(`${LOG_PREFIX} 📋 処理順序`, sortedDomains.map((d) => `${d.name}(${d.type})`));

          const chunkResults: ChunkResult[] = [];
          const domainResults: {
            domain: string;
            totalRecords: number;
            successfulChunks: number;
            failedChunks: number;
          }[] = [];
          let totalRecords = 0;
          let successfulChunks = 0;
          let failedChunks = 0;

          // 各ドメインを順番に処理
          for (let domainIndex = 0; domainIndex < sortedDomains.length; domainIndex++) {
            const domainInfo = sortedDomains[domainIndex];
            const result = await processChunksForDomain(
              zip,
              domainInfo.name,
              domainInfo.chunkCount,
              domainInfo.name,
              domainIndex + 1,
              sortedDomains.length,
              domainInfo.type
            );

            chunkResults.push(...result.results);
            totalRecords += result.records;
            successfulChunks += result.successful;
            failedChunks += result.failed;

            domainResults.push({
              domain: domainInfo.name,
              totalRecords: result.records,
              successfulChunks: result.successful,
              failedChunks: result.failed,
            });
          }

          // v1.1 完了ログ
          console.log(`${LOG_PREFIX} 🎉 インポート完了 (v1.1)`, {
            totalRecords,
            successfulChunks,
            failedChunks,
            domainResults,
          });
          if (failedChunks > 0) {
            console.warn(
              `${LOG_PREFIX} ⚠️ 失敗したチャンク一覧:`,
              chunkResults.filter((r) => !r.success)
            );
          }

          setResult({
            totalRecords,
            successfulChunks,
            failedChunks,
            chunkResults,
            domainResults,
            isMultiDomain: true,
          });

          // インポート成功時にコールバック
          if (successfulChunks > 0 && onImportSuccess) {
            onImportSuccess();
          }
          return;
        }

        // v1.0（単一ドメイン）の処理
        const manifest = rawManifest as ManifestV1;
        console.log(`${LOG_PREFIX} 📦 v1.0 単一ドメインモード`, {
          domain: manifest.domain,
          chunkCount: manifest.chunkCount,
          totalRecords: manifest.totalRecords,
        });

        // ドメイン検証
        if (manifest.domain !== domain) {
          throw new Error(`ドメインが一致しません: ${manifest.domain} !== ${domain}`);
        }

        // 単一ドメインの処理
        const importResult = await processChunksForDomain(
          zip,
          domain,
          manifest.chunkCount,
          "",
          undefined,
          undefined,
          "main"
        );

        // v1.0 完了ログ
        console.log(`${LOG_PREFIX} 🎉 インポート完了 (v1.0)`, {
          totalRecords: importResult.records,
          successfulChunks: importResult.successful,
          failedChunks: importResult.failed,
        });
        if (importResult.failed > 0) {
          console.warn(
            `${LOG_PREFIX} ⚠️ 失敗したチャンク一覧:`,
            importResult.results.filter((r) => !r.success)
          );
        }

        setResult({
          totalRecords: importResult.records,
          successfulChunks: importResult.successful,
          failedChunks: importResult.failed,
          chunkResults: importResult.results,
        });

        // インポート成功時にコールバック
        if (importResult.successful > 0 && onImportSuccess) {
          onImportSuccess();
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} ❌ インポート失敗:`, err);
        setError(err instanceof Error ? err.message : "インポートに失敗しました");
      } finally {
        setIsImporting(false);
        setProgress(null);
      }
    },
    [domain, onImportSuccess, processChunksForDomain]
  );

  const resetResult = useCallback(() => {
    setResult(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isImporting,
    progress,
    result,
    error,
    handleImport,
    resetResult,
    clearError,
  };
}
