// src/lib/dataMigration/export/index.ts

import "server-only";
import { getServiceOrThrow } from "@/lib/crud/utils";
import { getDataMigrationConfig, CHUNK_SIZE } from "../config";
import { generateCsv, csvToBuffer } from "./generateCsv";
import { createZip, downloadImage, extractFilename, type ZipEntry } from "./createZip";

export type ExportOptions = {
  /** ドメイン名 */
  domain: string;
  /** エクスポートするフィールド名 */
  selectedFields: string[];
  /** 画像を含めるか */
  includeImages: boolean;
  /** 検索パラメータ（URL クエリ文字列形式） */
  searchParams?: string;
  /** 画像フィールド名のリスト */
  imageFields?: string[];
};

export type ExportResult = {
  success: true;
  zipBuffer: Buffer;
  filename: string;
  recordCount: number;
  chunkCount: number;
};

/**
 * マニフェストファイルの型
 */
export type ExportManifest = {
  version: string;
  domain: string;
  exportedAt: string;
  totalRecords: number;
  chunkCount: number;
  fields: string[];
};

export type ExportError = {
  success: false;
  error: string;
  code: "TOO_MANY_RECORDS" | "INVALID_DOMAIN" | "EXPORT_ERROR";
  details?: {
    recordCount?: number;
    limit?: number;
  };
};

/**
 * システムフィールドの順序
 */
const SYSTEM_FIELDS_START = ["id"];
const SYSTEM_FIELDS_END = ["createdAt", "updatedAt", "deletedAt"];

/**
 * フィールドを仕様通りの順序に並べる
 * id -> ドメインフィールド -> createdAt/updatedAt/deletedAt
 */
function orderFields(selectedFields: string[]): string[] {
  const systemStart = SYSTEM_FIELDS_START.filter((f) => selectedFields.includes(f));
  const systemEnd = SYSTEM_FIELDS_END.filter((f) => selectedFields.includes(f));
  const domainFields = selectedFields.filter(
    (f) => !SYSTEM_FIELDS_START.includes(f) && !SYSTEM_FIELDS_END.includes(f)
  );
  return [...systemStart, ...domainFields, ...systemEnd];
}

/**
 * 検索パラメータを解析
 */
function parseSearchParams(searchParams?: string): Record<string, string> {
  if (!searchParams) return {};
  const params = new URLSearchParams(searchParams);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * データをエクスポート
 */
export async function exportData(
  options: ExportOptions
): Promise<ExportResult | ExportError> {
  const { domain, selectedFields, includeImages, searchParams, imageFields = [] } = options;
  const config = getDataMigrationConfig();

  // サービスを取得
  let service: any;
  try {
    service = getServiceOrThrow(domain);
  } catch {
    return {
      success: false,
      error: `Invalid domain: ${domain}`,
      code: "INVALID_DOMAIN",
    };
  }

  // searchWithDeleted が存在しない場合は listWithDeleted を使用
  const hasSearchWithDeleted = typeof service.searchWithDeleted === "function";
  const hasListWithDeleted = typeof service.listWithDeleted === "function";

  if (!hasSearchWithDeleted && !hasListWithDeleted) {
    return {
      success: false,
      error: `Domain ${domain} does not support export (no searchWithDeleted or listWithDeleted)`,
      code: "INVALID_DOMAIN",
    };
  }

  try {
    const parsedParams = parseSearchParams(searchParams);
    const searchQuery = parsedParams.searchQuery;

    // フィールドを順序通りに並べる
    const orderedFields = orderFields(selectedFields);

    // ZIP エントリを作成
    const zipEntries: ZipEntry[] = [];

    // レコードをチャンクごとに取得・処理（削除済み含む）
    let page = 1;
    let chunkIndex = 1;
    let totalRecordCount = 0;
    let hasMore = true;

    console.log(`[Export] Starting chunked export for domain: ${domain}, chunkSize: ${CHUNK_SIZE}`);

    while (hasMore) {
      let chunkRecords: Record<string, unknown>[];

      if (hasSearchWithDeleted) {
        // searchWithDeleted を使用（検索条件対応）
        const result = await service.searchWithDeleted({
          searchQuery,
          limit: CHUNK_SIZE,
          page,
        });
        chunkRecords = result.results || [];
      } else {
        // listWithDeleted を使用（全件取得、ページネーションなし）
        const allRecords = await service.listWithDeleted();
        // listWithDeleted の場合は手動でチャンク分割
        const start = (page - 1) * CHUNK_SIZE;
        chunkRecords = allRecords.slice(start, start + CHUNK_SIZE);
        hasMore = start + CHUNK_SIZE < allRecords.length;
      }

      // レコードがない場合は終了
      if (chunkRecords.length === 0) {
        break;
      }

      totalRecordCount += chunkRecords.length;

      // 最大件数チェック（超過したら即座にエラー）
      if (totalRecordCount > config.maxRecordLimit) {
        return {
          success: false,
          error: `Record count exceeds limit`,
          code: "TOO_MANY_RECORDS",
          details: {
            recordCount: totalRecordCount,
            limit: config.maxRecordLimit,
          },
        };
      }

      // チャンクフォルダ名（3桁ゼロパディング）
      const chunkFolderName = `chunk_${String(chunkIndex).padStart(3, "0")}`;

      console.log(`[Export] Processing ${chunkFolderName}: ${chunkRecords.length} records`);

      // このチャンクの CSV を生成
      const csv = generateCsv(chunkRecords, { fields: orderedFields });
      const csvBuffer = csvToBuffer(csv);

      zipEntries.push({
        path: `${chunkFolderName}/data.csv`,
        content: csvBuffer,
      });

      // 画像を含める場合
      if (includeImages && imageFields.length > 0) {
        for (const record of chunkRecords) {
          const recordId = String(record.id || "unknown");

          for (const imageField of imageFields) {
            const imageUrl = record[imageField];
            if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
              const imageBuffer = await downloadImage(imageUrl);
              if (imageBuffer) {
                const filename = extractFilename(imageUrl, recordId);
                zipEntries.push({
                  path: `${chunkFolderName}/assets/${imageField}/${filename}`,
                  content: imageBuffer,
                });
              }
            }
          }
        }
      }

      // 次のチャンクがあるかどうか
      if (hasSearchWithDeleted) {
        hasMore = chunkRecords.length === CHUNK_SIZE;
      }

      page++;
      chunkIndex++;
    }

    // 実際のチャンク数（chunkIndex は次のチャンク番号なので -1）
    const actualChunkCount = chunkIndex - 1;

    console.log(`[Export] Total records: ${totalRecordCount}, chunks: ${actualChunkCount}`);

    // レコードが0件の場合
    if (totalRecordCount === 0) {
      // 空のチャンクを作成（構造を維持）
      const csv = generateCsv([], { fields: orderedFields });
      const csvBuffer = csvToBuffer(csv);
      zipEntries.push({
        path: "chunk_001/data.csv",
        content: csvBuffer,
      });
    }

    // マニフェストファイルを作成
    const finalChunkCount = totalRecordCount === 0 ? 1 : actualChunkCount;
    const manifest: ExportManifest = {
      version: "1.0",
      domain,
      exportedAt: new Date().toISOString(),
      totalRecords: totalRecordCount,
      chunkCount: finalChunkCount,
      fields: orderedFields,
    };

    zipEntries.unshift({
      path: "manifest.json",
      content: Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"),
    });

    // ZIP を作成
    const zipBuffer = await createZip(zipEntries);

    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${domain}_${timestamp}.zip`;

    console.log(`[Export] Completed: ${totalRecordCount} records, filename: ${filename}`);

    return {
      success: true,
      zipBuffer,
      filename,
      recordCount: totalRecordCount,
      chunkCount: finalChunkCount,
    };
  } catch (error) {
    console.error("Export error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown export error",
      code: "EXPORT_ERROR",
    };
  }
}
