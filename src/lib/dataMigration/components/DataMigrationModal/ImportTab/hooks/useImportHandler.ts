// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/useImportHandler.ts
// インポート処理のロジックフック

"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import JSZip from "jszip";
import { storageClient, uploadToStorage, type UploadedFile } from "@/lib/storage/client";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { contentTypeFromFilename, mediaPurposeOf } from "../../../../media";
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
  /**
   * 画像フィールド名の配列（ログ用。アップロード対象は ZIP の assets/<列>/ から決め、メディア列の判定はサーバーが行う）
   */
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

/** 1 ファイルを用途にアップロードする（uploadToStorage を Promise にしたもの） */
function uploadOne(file: Blob, purpose: string): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    uploadToStorage(file, {
      purpose,
      // export した画像をそのまま戻す（端末で描き直さない。strip の用途ならサーバーが commit で描き直す）
      reencodeImage: false,
      onComplete: resolve,
      onError: reject,
    });
  });
}

/** 取り込みに使わなかったアップロードを取り消す（失敗しても未採用のファイルは掃除で消える） */
async function discardUploads(uploads: readonly UploadedFile[]): Promise<void> {
  await Promise.all(
    uploads.map((upload) =>
      storageClient.discard(upload.objectId).catch((err) => {
        console.error(`${LOG_PREFIX} 取り消しに失敗しました（未採用のファイルは掃除で消えます）: ${upload.ref}`, err);
      }),
    ),
  );
}

/**
 * 同梱ファイルを用途 `<ドメイン>.<列>` にアップロードし、`assets/<列>/<ファイル名>` → ref のマップを返す。
 * 1 件でも失敗したら、このチャンクで上げた分を取り消して throw する（黙って空にしない）
 */
async function uploadAssets(
  assets: Map<string, ArrayBuffer>,
  domain: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<{ refMap: Map<string, string>; uploads: UploadedFile[] }> {
  const refMap = new Map<string, string>();
  const uploads: UploadedFile[] = [];
  const entries = Array.from(assets.entries());
  const camelDomain = toCamelCase(domain);

  for (const [assetPath, buffer] of entries) {
    // フィールド名を取得（例: main_image/xxx.jpg → main_image）
    const fieldName = assetPath.split("/")[0] || "assets";
    const filename = assetPath.split("/").pop() || assetPath;
    try {
      const blob = new Blob([buffer], { type: contentTypeFromFilename(filename) });
      const uploaded = await uploadOne(blob, mediaPurposeOf(camelDomain, fieldName));
      uploads.push(uploaded);
      refMap.set(`assets/${assetPath}`, uploaded.ref);
      onProgress?.(uploads.length, entries.length);
    } catch (err) {
      console.error(`${LOG_PREFIX} 画像アップロード失敗: ${assetPath}`, err);
      await discardUploads(uploads);
      const reason = err instanceof Error ? err.message : "不明なエラー";
      throw new Error(`画像のアップロードに失敗しました: ${assetPath}（${reason}）`);
    }
  }

  return { refMap, uploads };
}

/**
 * CSVコンテンツ内の画像パス（assets/...）を実際のURLに置換
 */
function replaceAssetPathsInCsv(csvContent: string, urlMap: Map<string, string>): string {
  let result = csvContent;
  for (const [assetPath, url] of urlMap.entries()) {
    // CSVではカンマやダブルクォートでエスケープされている可能性があるため、
    // 単純な置換で対応
    result = result.split(assetPath).join(url);
  }
  return result;
}

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
        let csvContent = await csvFile.async("string");

        // 同梱ファイル（assets/<列>/…）を用途 `<ドメイン>.<列>` にアップロードし、CSV の値を ref に置き換える
        // （メイン以外のドメインも同じ。中間テーブルはメディア列を持たない）
        let uploads: UploadedFile[] = [];
        const assetsFolder = domainType === "junction" ? null : zip.folder(`${chunkPath}/assets`);
        if (assetsFolder) {
          const actualAssetFiles = assetsFolder.filter(() => true).filter((f) => !f.dir);

          if (actualAssetFiles.length > 0) {
            console.log(`${LOG_PREFIX}     🖼️ 画像をアップロード: ${actualAssetFiles.length} ファイル`, {
              path: `${chunkPath}/assets`,
            });

            // アセットを収集
            const assets = new Map<string, ArrayBuffer>();
            for (const assetFile of actualAssetFiles) {
              const assetBuffer = await assetFile.async("arraybuffer");
              const assetPath = assetFile.name.replace(`${chunkPath}/assets/`, "");
              assets.set(assetPath, assetBuffer);
            }

            try {
              const uploaded = await uploadAssets(assets, domainName, (done, total) => {
                console.log(`${LOG_PREFIX}       📤 アップロード進捗: ${done}/${total}`);
              });
              uploads = uploaded.uploads;
              // CSVの画像パスを ref に置換
              csvContent = replaceAssetPathsInCsv(csvContent, uploaded.refMap);
              console.log(`${LOG_PREFIX}     ✅ 画像アップロード完了、CSVを更新`);
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : "画像のアップロードに失敗しました";
              console.error(`${LOG_PREFIX}   ❌ チャンク失敗: ${chunkName}`, { domain: domainName, error: errorMsg });
              results.push({ chunkName, domain: domainName, success: false, recordCount: 0, error: errorMsg });
              failed++;
              continue;
            }
          }
        }

        // FormData を作成（画像バイナリは含まない）
        const formData = new FormData();
        formData.append("domain", domainName);
        formData.append("chunkName", chunkName);
        formData.append("csvContent", csvContent);
        // 今回アップロードした ref（サーバーはこれをそのまま紐付ける。それ以外の ref・旧 URL は複製する）
        formData.append("uploadedRefs", JSON.stringify(uploads.map((upload) => upload.ref)));
        // メインドメインのみフィールド型情報を送る
        formData.append("fields", JSON.stringify(domainName === domain ? fieldTypeInfo : []));
        // ドメインタイプを送る
        if (domainType) {
          formData.append("domainType", domainType);
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
          // チャンクは巻き戻っているので、このチャンクで上げたファイルは使われない
          await discardUploads(uploads);
        }
      }

      // ドメイン処理完了ログ
      console.log(
        `${LOG_PREFIX} 📦 ドメイン処理完了: ${domainName}`,
        { records, successful, failed }
      );

      return { records, successful, failed, results };
    },
    [domain, fields]
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
    [domain, imageFields, fields.length, onImportSuccess, processChunksForDomain]
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
