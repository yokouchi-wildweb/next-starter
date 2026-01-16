// src/lib/dataMigration/import/importChunk.ts

import "server-only";
import { v7 as uuidv7 } from "uuid";
import { getServiceOrThrow, getJunctionTable } from "@/lib/domain/server";
import { uploadFileServer } from "@/lib/firebase/server/storage";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { parseCsv } from "./parseCsv";
import { db } from "@/lib/drizzle";
import type { FieldTypeInfo } from "./index";

export type ImportChunkOptions = {
  /** ドメイン名 */
  domain: string;
  /** チャンク名 */
  chunkName: string;
  /** CSV コンテンツ（文字列） */
  csvContent: string;
  /** アセットファイル（画像など） */
  assets: Map<string, Buffer>;
  /** 画像フィールド名のリスト */
  imageFields?: string[];
  /** 画像を更新するか（default: true） */
  updateImages?: boolean;
  /** フィールド型情報（型変換用） */
  fields?: FieldTypeInfo[];
  /** ドメインタイプ（main/related/junction/hasMany） */
  domainType?: "main" | "related" | "junction" | "hasMany";
};

export type ImportChunkResult =
  | {
      success: true;
      chunkName: string;
      recordCount: number;
    }
  | {
      success: false;
      chunkName: string;
      error: string;
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
 * システムフィールドのキー名変換マップ（camelCase → snake_case）
 */
const SYSTEM_FIELD_KEY_MAP: Record<string, string> = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
};

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
 * 中間テーブル用のインポート処理
 * サービスを使わず直接 Drizzle で挿入
 */
async function importJunctionChunk(options: {
  domain: string;
  chunkName: string;
  csvContent: string;
}): Promise<ImportChunkResult> {
  const { domain, chunkName, csvContent } = options;

  // 中間テーブルを取得
  const junctionTable = getJunctionTable(domain);
  if (!junctionTable) {
    return {
      success: false,
      chunkName,
      error: `Junction table not found: ${domain}`,
    };
  }

  try {
    // CSV パース
    const csvResult = parseCsv(csvContent);
    if (!csvResult.success) {
      return {
        success: false,
        chunkName,
        error: `CSV parse error: ${csvResult.error}`,
      };
    }

    const { records } = csvResult;

    if (records.length === 0) {
      return {
        success: true,
        chunkName,
        recordCount: 0,
      };
    }

    // 既存レコードを削除してから挿入（upsert の代わりに置換）
    // 中間テーブルは複合主キーで upsert が複雑なため、onConflictDoNothing を使用
    await db
      .insert(junctionTable as any)
      .values(records as any[])
      .onConflictDoNothing();

    return {
      success: true,
      chunkName,
      recordCount: records.length,
    };
  } catch (error) {
    console.error(`[Import] Junction chunk ${chunkName} failed:`, error);
    return {
      success: false,
      chunkName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * チャンク単位でデータをインポート
 */
export async function importChunk(
  options: ImportChunkOptions
): Promise<ImportChunkResult> {
  const {
    domain,
    chunkName,
    csvContent,
    assets,
    imageFields = [],
    updateImages = true,
    fields = [],
    domainType,
  } = options;

  // 中間テーブルの場合は直接 DB 挿入
  if (domainType === "junction") {
    return importJunctionChunk({ domain, chunkName, csvContent });
  }

  // サービスを取得（serviceRegistry は camelCase キーのため変換）
  const serviceDomainKey = toCamelCase(domain);
  let service: any;
  try {
    service = getServiceOrThrow(serviceDomainKey);
  } catch {
    return {
      success: false,
      chunkName,
      error: `Invalid domain: ${domain}`,
    };
  }

  // bulkUpsert が存在するか確認
  if (typeof service.bulkUpsert !== "function") {
    return {
      success: false,
      chunkName,
      error: `Domain ${domain} does not support import (no bulkUpsert)`,
    };
  }

  try {
    // CSV パース
    const csvResult = parseCsv(csvContent);
    if (!csvResult.success) {
      return {
        success: false,
        chunkName,
        error: `CSV parse error: ${csvResult.error}`,
      };
    }

    const { records } = csvResult;

    if (records.length === 0) {
      return {
        success: true,
        chunkName,
        recordCount: 0,
      };
    }

    // フィールド型情報を取得
    const { arrayFields, dateFields, numberFields } = getFieldTypes(fields);

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
    console.log(`[Import] Image processing: updateImages=${updateImages}, imageFields=${JSON.stringify(imageFields)}, assets.size=${assets.size}`);
    if (updateImages && imageFields.length > 0 && assets.size > 0) {
      const urlUpdates: { id: string; updates: Record<string, string> }[] = [];
      const assetKeys = Array.from(assets.keys());
      console.log(`[Import] Asset keys: ${JSON.stringify(assetKeys)}`);

      for (let i = 0; i < records.length; i++) {
        const originalRecord = records[i];
        const upsertedRecord = upsertedRecords[i];
        if (!upsertedRecord) continue;

        const recordId = String(upsertedRecord.id);
        const updates: Record<string, string> = {};

        for (const imageField of imageFields) {
          const csvValue = originalRecord[imageField];
          console.log(`[Import] Record ${recordId}, field ${imageField}: csvValue=${csvValue}`);
          // CSV に assets/ パスが記載されている場合
          if (typeof csvValue === "string" && csvValue.startsWith("assets/")) {
            // assets/main_image/uuid.jpg -> main_image/uuid.jpg
            const assetPath = csvValue.replace(/^assets\//, "");
            const assetBuffer = assets.get(assetPath);
            console.log(`[Import] Looking for asset: ${assetPath}, found: ${!!assetBuffer}`);

            if (assetBuffer) {
              const filename = assetPath.split("/").pop() || "image";
              const newUrl = await uploadImage(domain, imageField, filename, assetBuffer);
              updates[imageField] = newUrl;
              console.log(`[Import] Uploaded ${imageField}: ${newUrl}`);
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
      success: true,
      chunkName,
      recordCount: records.length,
    };
  } catch (error) {
    console.error(`[Import] Chunk ${chunkName} failed:`, error);
    return {
      success: false,
      chunkName,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
