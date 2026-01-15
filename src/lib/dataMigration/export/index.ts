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
    // レコードを取得（削除済み含む）
    let records: Record<string, unknown>[];

    const parsedParams = parseSearchParams(searchParams);

    if (hasSearchWithDeleted) {
      // searchWithDeleted を使用（検索条件対応）
      const searchQuery = parsedParams.searchQuery;
      // 全件取得のため limit を大きく設定
      const result = await service.searchWithDeleted({
        searchQuery,
        limit: config.maxRecordLimit + 1, // 制限超過チェック用に +1
        page: 1,
      });
      records = result.results || [];
    } else {
      // listWithDeleted を使用（全件取得）
      records = await service.listWithDeleted();
    }

    // レコード数チェック
    if (records.length > config.maxRecordLimit) {
      return {
        success: false,
        error: `Record count exceeds limit`,
        code: "TOO_MANY_RECORDS",
        details: {
          recordCount: records.length,
          limit: config.maxRecordLimit,
        },
      };
    }

    // フィールドを順序通りに並べる
    const orderedFields = orderFields(selectedFields);

    // CSV を生成
    const csv = generateCsv(records, { fields: orderedFields });
    const csvBuffer = csvToBuffer(csv);

    // ZIP エントリを作成
    const zipEntries: ZipEntry[] = [
      { path: "data.csv", content: csvBuffer },
    ];

    // 画像を含める場合
    if (includeImages && imageFields.length > 0) {
      // チャンクごとに処理
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);

        for (const record of chunk) {
          const recordId = String(record.id || "unknown");

          for (const imageField of imageFields) {
            const imageUrl = record[imageField];
            if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
              const imageBuffer = await downloadImage(imageUrl);
              if (imageBuffer) {
                const filename = extractFilename(imageUrl, recordId);
                zipEntries.push({
                  path: `assets/${imageField}/${filename}`,
                  content: imageBuffer,
                });
              }
            }
          }
        }
      }
    }

    // ZIP を作成
    const zipBuffer = await createZip(zipEntries);

    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${domain}_${timestamp}.zip`;

    return {
      success: true,
      zipBuffer,
      filename,
      recordCount: records.length,
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
