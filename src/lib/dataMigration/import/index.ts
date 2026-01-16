// src/lib/dataMigration/import/index.ts

import "server-only";
import { v7 as uuidv7 } from "uuid";
import { getServiceOrThrow } from "@/lib/domain/server";
import { uploadFileServer } from "@/lib/firebase/server/storage";
import { getDataMigrationConfig } from "../config";
import { parseZip, type ParsedChunk } from "./parseZip";
import { parseCsv } from "./parseCsv";

export type FieldTypeInfo = {
  name: string;
  fieldType?: string;
};

export type ImportOptions = {
  /** ドメイン名 */
  domain: string;
  /** ZIP ファイルの Buffer */
  zipBuffer: Buffer;
  /** 画像フィールド名のリスト */
  imageFields?: string[];
  /** 画像を更新するか（default: true） */
  updateImages?: boolean;
  /** フィールド型情報（型変換用） */
  fields?: FieldTypeInfo[];
};

export type ChunkResult = {
  chunkName: string;
  success: boolean;
  recordCount: number;
  error?: string;
};

export type ImportResult = {
  success: true;
  totalRecords: number;
  successfulChunks: number;
  failedChunks: number;
  chunkResults: ChunkResult[];
};

export type ImportError = {
  success: false;
  error: string;
  code:
    | "INVALID_ZIP"
    | "MISSING_MANIFEST"
    | "INVALID_MANIFEST"
    | "DOMAIN_MISMATCH"
    | "NO_CHUNKS"
    | "TOO_MANY_RECORDS"
    | "INVALID_DOMAIN"
    | "IMPORT_ERROR"
    | "UNSUPPORTED_VERSION";
  details?: {
    recordCount?: number;
    limit?: number;
  };
};

/**
 * MIME タイプを拡張子から推測
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * 画像をアップロードして URL を取得
 */
async function uploadImage(
  domain: string,
  fieldName: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const ext = filename.includes(".") ? filename.substring(filename.lastIndexOf(".")) : "";
  const path = `${domain}/${fieldName}/${uuidv7()}${ext}`;
  const mimeType = getMimeType(filename);
  return uploadFileServer(path, buffer, mimeType);
}

/**
 * fieldType に基づいてフィールドタイプを判定
 */
function getFieldTypes(fields: FieldTypeInfo[]): {
  arrayFields: Set<string>;
  dateFields: Set<string>;
  numberFields: Set<string>;
} {
  const arrayFields = new Set<string>();
  const dateFields = new Set<string>();
  const numberFields = new Set<string>();

  for (const field of fields) {
    const { name, fieldType } = field;
    const normalizedType = fieldType?.toLowerCase() || "";

    // 配列型
    if (normalizedType === "array") {
      arrayFields.add(name);
      continue;
    }

    // 日付/時間型
    if (
      normalizedType === "date" ||
      normalizedType === "time" ||
      normalizedType.includes("timestamp")
    ) {
      dateFields.add(name);
      continue;
    }

    // 数値型
    if (
      normalizedType === "integer" ||
      normalizedType === "number" ||
      normalizedType === "float" ||
      normalizedType === "decimal" ||
      normalizedType === "bigint"
    ) {
      numberFields.add(name);
      continue;
    }
  }

  return { arrayFields, dateFields, numberFields };
}

/**
 * システムフィールドのキー名変換マップ（camelCase → snake_case）
 */
const SYSTEM_FIELD_KEY_MAP: Record<string, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
};

/**
 * レコードのフィールド値を適切な型に変換
 */
function convertRecordTypes(
  record: Record<string, unknown>,
  arrayFields: Set<string>,
  dateFields: Set<string>,
  numberFields: Set<string>
): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [originalKey, value] of Object.entries(record)) {
    // システムフィールドのキー名を変換
    const key = SYSTEM_FIELD_KEY_MAP[originalKey] || originalKey;
    // 配列フィールドの変換
    if (arrayFields.has(key)) {
      if (value === null || value === undefined || value === "") {
        converted[key] = [];
      } else if (typeof value === "string") {
        // カンマ区切り文字列を配列に変換
        converted[key] = value.split(",").map((v) => v.trim()).filter((v) => v !== "");
      } else if (Array.isArray(value)) {
        converted[key] = value;
      } else {
        converted[key] = [value];
      }
      continue;
    }

    // 日付フィールドの変換
    if (dateFields.has(key)) {
      if (value === null || value === undefined || value === "") {
        converted[key] = null;
      } else if (typeof value === "string") {
        // ISO 8601 文字列はそのまま（Zodが検証）、ただし不正な値は null
        const date = new Date(value);
        converted[key] = isNaN(date.getTime()) ? null : value;
      } else {
        converted[key] = value;
      }
      continue;
    }

    // 数値フィールドの変換
    if (numberFields.has(key)) {
      if (value === null || value === undefined || value === "") {
        converted[key] = null;
      } else if (typeof value === "string") {
        const num = Number(value);
        converted[key] = isNaN(num) ? null : num;
      } else {
        converted[key] = value;
      }
      continue;
    }

    // その他のフィールドはそのまま
    converted[key] = value;
  }

  return converted;
}

/**
 * チャンクを処理
 */
async function processChunk(
  chunk: ParsedChunk,
  domain: string,
  service: any,
  imageFields: string[],
  updateImages: boolean,
  arrayFields: Set<string>,
  dateFields: Set<string>,
  numberFields: Set<string>
): Promise<ChunkResult> {
  const { chunkName, csvContent, assets } = chunk;

  try {
    // CSV パース
    const csvResult = parseCsv(csvContent);
    if (!csvResult.success) {
      return {
        chunkName,
        success: false,
        recordCount: 0,
        error: `CSV parse error: ${csvResult.error}`,
      };
    }

    const { records } = csvResult;

    if (records.length === 0) {
      return {
        chunkName,
        success: true,
        recordCount: 0,
      };
    }

    // 画像フィールドを一旦除外し、型変換を適用してレコードを準備
    const recordsForUpsert = records.map((record) => {
      // まず型変換を適用
      const typedRecord = convertRecordTypes(record, arrayFields, dateFields, numberFields);

      const cleanRecord: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(typedRecord)) {
        // 画像フィールドは後で処理するので除外（updateImages が true の場合）
        if (updateImages && imageFields.includes(key)) {
          continue;
        }
        cleanRecord[key] = value;
      }
      return cleanRecord;
    });

    // bulkUpsert 実行
    const upsertResult = await service.bulkUpsert(recordsForUpsert);
    const upsertedRecords = upsertResult.results as Record<string, unknown>[];

    // 画像アップロードと URL 更新
    if (updateImages && imageFields.length > 0 && assets.size > 0) {
      const urlUpdates: { id: string; updates: Record<string, string> }[] = [];

      for (let i = 0; i < records.length; i++) {
        const originalRecord = records[i];
        const upsertedRecord = upsertedRecords[i];
        if (!upsertedRecord) continue;

        const recordId = String(upsertedRecord.id);
        const updates: Record<string, string> = {};

        for (const imageField of imageFields) {
          const csvValue = originalRecord[imageField];
          // CSV に assets/ パスが記載されている場合
          if (typeof csvValue === "string" && csvValue.startsWith("assets/")) {
            // assets/main_image/uuid.jpg -> main_image/uuid.jpg
            const assetPath = csvValue.replace(/^assets\//, "");
            const assetBuffer = assets.get(assetPath);

            if (assetBuffer) {
              const filename = assetPath.split("/").pop() || "image";
              const newUrl = await uploadImage(domain, imageField, filename, assetBuffer);
              updates[imageField] = newUrl;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          urlUpdates.push({ id: recordId, updates });
        }
      }

      // URL を一括更新
      for (const { id, updates } of urlUpdates) {
        await service.update(id, updates);
      }
    }

    return {
      chunkName,
      success: true,
      recordCount: records.length,
    };
  } catch (error) {
    console.error(`[Import] Chunk ${chunkName} failed:`, error);
    return {
      chunkName,
      success: false,
      recordCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * データをインポート
 */
export async function importData(
  options: ImportOptions
): Promise<ImportResult | ImportError> {
  const { domain, zipBuffer, imageFields = [], updateImages = true, fields = [] } = options;
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

  // bulkUpsert が存在するか確認
  if (typeof service.bulkUpsert !== "function") {
    return {
      success: false,
      error: `Domain ${domain} does not support import (no bulkUpsert)`,
      code: "INVALID_DOMAIN",
    };
  }

  // ZIP パース
  const zipResult = parseZip(zipBuffer, domain);
  if (!zipResult.success) {
    return {
      success: false,
      error: zipResult.error,
      code: zipResult.code,
    };
  }

  const { manifest, chunks } = zipResult;

  console.log(
    `[Import] Starting import for domain: ${domain}, totalRecords: ${manifest.totalRecords}, chunks: ${chunks.length}`
  );

  // 総レコード数チェック
  if (manifest.totalRecords > config.maxRecordLimit) {
    return {
      success: false,
      error: `Record count exceeds limit`,
      code: "TOO_MANY_RECORDS",
      details: {
        recordCount: manifest.totalRecords,
        limit: config.maxRecordLimit,
      },
    };
  }

  // フィールド型情報を取得
  const { arrayFields, dateFields, numberFields } = getFieldTypes(fields);

  // 各チャンクを処理
  const chunkResults: ChunkResult[] = [];
  let totalRecords = 0;
  let successfulChunks = 0;
  let failedChunks = 0;

  for (const chunk of chunks) {
    console.log(`[Import] Processing ${chunk.chunkName}...`);

    const result = await processChunk(
      chunk,
      domain,
      service,
      imageFields,
      updateImages,
      arrayFields,
      dateFields,
      numberFields
    );
    chunkResults.push(result);

    if (result.success) {
      successfulChunks++;
      totalRecords += result.recordCount;
    } else {
      failedChunks++;
      console.error(`[Import] ${chunk.chunkName} failed: ${result.error}`);
    }
  }

  console.log(
    `[Import] Completed: ${totalRecords} records, ${successfulChunks} successful chunks, ${failedChunks} failed chunks`
  );

  return {
    success: true,
    totalRecords,
    successfulChunks,
    failedChunks,
    chunkResults,
  };
}
