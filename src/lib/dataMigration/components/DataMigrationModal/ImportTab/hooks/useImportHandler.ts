// src/lib/dataMigration/components/DataMigrationModal/ImportTab/hooks/useImportHandler.ts
// インポート処理のロジックフック

"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import JSZip from "jszip";
import { storageClient, uploadToStorage, type UploadedFile } from "@/lib/storage/client";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { contentTypeFromFilename, mediaPurposeOf } from "../../../../media";
import { buildImportFieldTypeInfo } from "./importFieldTypeInfo";
import { chunkNameOf, runImportSteps, sortImportSteps, type ImportStep } from "./importRun";
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
  /** インポートで DB が変わったときのコールバック（途中で止まった場合も、入ったチャンクがあれば呼ぶ。一覧の再取得用） */
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
   * 1 チャンクを処理する（成功・失敗を ChunkResult で返す。投げない）
   */
  const processChunk = useCallback(
    async (zip: JSZip, step: ImportStep, chunkIndex: number, stepIndex: number, totalSteps: number | undefined): Promise<ChunkResult> => {
      const { name: domainName, type: domainType, chunkCount, chunkPrefix } = step;
      const chunkName = chunkNameOf(chunkIndex);
      const chunkPath = chunkPrefix ? `${chunkPrefix}/${chunkName}` : chunkName;
      // v1.0（単一ドメイン）は totalSteps を渡さない（進捗にドメインの番号を出さない）
      const isMultiDomain = totalSteps !== undefined;

      if (chunkIndex === 0) {
        console.log(
          `${LOG_PREFIX} 📦 ドメイン処理開始: ${domainName} ${isMultiDomain ? `[${stepIndex + 1}/${totalSteps}]` : ""}`,
          { type: domainType, chunkCount, chunkPrefix: chunkPrefix || "(root)" }
        );
      }

      setProgress({
        currentDomain: domainName,
        currentDomainIndex: isMultiDomain ? stepIndex + 1 : undefined,
        totalDomains: isMultiDomain ? totalSteps : undefined,
        currentChunk: chunkIndex + 1,
        totalChunks: chunkCount,
        currentChunkName: chunkName,
      });

      console.log(
        `${LOG_PREFIX}   📄 チャンク処理: ${chunkName} [${chunkIndex + 1}/${chunkCount}]`,
        { domain: domainName, path: chunkPath }
      );

      const fail = (error: string): ChunkResult => {
        console.error(`${LOG_PREFIX}   ❌ チャンク失敗: ${chunkName}`, { domain: domainName, error });
        return { chunkName, domain: domainName, success: false, recordCount: 0, error };
      };

      // CSV ファイルを取得
      const csvFile = zip.file(`${chunkPath}/data.csv`);
      if (!csvFile) {
        return fail(`data.csv が見つかりません（${chunkPath}/data.csv）`);
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
            return fail(err instanceof Error ? err.message : "画像のアップロードに失敗しました");
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
      formData.append("fields", JSON.stringify(domainName === domain ? buildImportFieldTypeInfo(fields) : []));
      // ドメインタイプを送る
      formData.append("domainType", domainType);

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
        return { chunkName: data.chunkName, domain: domainName, success: true, recordCount: data.recordCount };
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
        console.error(`${LOG_PREFIX}   📋 エラー詳細:`, errorDetails);
        if (responseData) {
          console.error(`${LOG_PREFIX}   📋 サーバーレスポンス:`, JSON.stringify(responseData, null, 2));
        }
        // チャンクは巻き戻っているので、このチャンクで上げたファイルは使われない
        await discardUploads(uploads);
        return fail(errorMsg);
      }
    },
    [domain, fields]
  );

  /**
   * インポート実行（最初に失敗したチャンクで止める。止まっても、入ったチャンクがあれば onImportSuccess を呼ぶ）
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

        let steps: ImportStep[];
        const isMultiDomain = rawManifest.version === "1.1";
        if (isMultiDomain) {
          // v1.1（複数ドメイン）
          const manifest = rawManifest as ManifestV1_1;
          if (manifest.mainDomain !== domain) {
            throw new Error(`ドメインが一致しません: ${manifest.mainDomain} !== ${domain}`);
          }
          // インポート順序に従ってソート（related → main → hasMany → junction）
          steps = sortImportSteps(manifest.domains).map((d) => ({
            name: d.name,
            type: d.type,
            chunkCount: d.chunkCount,
            chunkPrefix: d.name,
          }));
        } else {
          // v1.0（単一ドメイン）
          const manifest = rawManifest as ManifestV1;
          if (manifest.domain !== domain) {
            throw new Error(`ドメインが一致しません: ${manifest.domain} !== ${domain}`);
          }
          steps = [{ name: domain, type: "main", chunkCount: manifest.chunkCount, chunkPrefix: "" }];
        }
        console.log(`${LOG_PREFIX} 📋 処理順序`, steps.map((s) => `${s.name}(${s.type})`));

        const outcome = await runImportSteps(steps, (step, chunkIndex, stepIndex) =>
          processChunk(zip, step, chunkIndex, stepIndex, isMultiDomain ? steps.length : undefined)
        );

        if (outcome.stoppedAt) {
          console.warn(`${LOG_PREFIX} ⛔ インポートを途中で止めました`, {
            stoppedAt: outcome.stoppedAt,
            committedRecords: outcome.totalRecords,
            notRunChunks: outcome.notRunChunks,
          });
        } else {
          console.log(`${LOG_PREFIX} 🎉 インポート完了`, {
            totalRecords: outcome.totalRecords,
            successfulChunks: outcome.successfulChunks,
            domainResults: outcome.domainResults,
          });
        }

        setResult({
          totalRecords: outcome.totalRecords,
          successfulChunks: outcome.successfulChunks,
          failedChunks: outcome.failedChunks,
          chunkResults: outcome.chunkResults,
          domainResults: isMultiDomain ? outcome.domainResults : undefined,
          isMultiDomain: isMultiDomain || undefined,
          stoppedAt: outcome.stoppedAt,
          notRunChunks: outcome.notRunChunks,
        });

        // DB が変わったとき（途中で止まった場合も、入ったチャンクがあれば）一覧を読み直させる
        if (outcome.successfulChunks > 0 && onImportSuccess) {
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
    [domain, imageFields, fields.length, onImportSuccess, processChunk]
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
