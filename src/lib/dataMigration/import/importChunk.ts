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
 * エラーオブジェクトから構造化された情報を抽出
 * drizzle のエラーは cause にネストされていることがある
 */
function extractErrorInfo(error: unknown): Record<string, unknown> {
  const info: Record<string, unknown> = {};

  if (!error || typeof error !== "object") {
    info.message = String(error);
    return info;
  }

  const err = error as Record<string, unknown>;
  info.type = err.constructor?.name;
  info.message = err.message;

  // PostgreSQL エラー情報（直接またはcause経由）
  const pgSource = err.cause && typeof err.cause === "object" ? err.cause as Record<string, unknown> : err;
  if (pgSource.code) info.pgCode = pgSource.code;
  if (pgSource.detail) info.pgDetail = pgSource.detail;
  if (pgSource.hint) info.pgHint = pgSource.hint;
  if (pgSource.constraint) info.pgConstraint = pgSource.constraint;
  if (pgSource.column) info.pgColumn = pgSource.column;
  if (pgSource.table) info.pgTable = pgSource.table;
  if (pgSource.dataType) info.pgDataType = pgSource.dataType;

  // さらにネストされた cause をチェック
  if (err.cause && typeof err.cause === "object") {
    const cause = err.cause as Record<string, unknown>;
    if (cause.cause && typeof cause.cause === "object") {
      const deepCause = cause.cause as Record<string, unknown>;
      if (deepCause.code && !info.pgCode) info.pgCode = deepCause.code;
      if (deepCause.detail && !info.pgDetail) info.pgDetail = deepCause.detail;
    }
  }

  return info;
}

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
 * 画像フィールドのプレースホルダー値
 * bulkUpsert 時に画像フィールドに設定し、アップロード完了後に実際の URL で更新する。
 * アップロード失敗時は null に変換される。
 */
export const PENDING_IMAGE_PLACEHOLDER = "__PENDING_IMAGE_UPLOAD__";

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

  for (const [key, value] of Object.entries(record)) {
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

    // 画像フィールドにプレースホルダーを設定し、型変換を適用してレコードを準備
    // deletedAt は parseUpsert で削除されるが、drizzle-orm が DEFAULT を使用するのを防ぐため
    // 明示的に null を設定する。実際の値は後で復元する。
    const deletedAtMap = new Map<number, string | null>(); // index -> deletedAt 値
    const recordsForUpsert = records.map((record, index) => {
      // まず型変換を適用
      const typedRecord = convertRecordTypes(record, arrayFields, dateFields, numberFields);

      const cleanRecord: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(typedRecord)) {
        // deletedAt の実際の値を保存（parseUpsert で削除されるため後で復元）
        if (key === "deletedAt") {
          if (value !== null && value !== undefined) {
            deletedAtMap.set(index, value as string);
          }
          continue; // ループ後に明示的に設定
        }
        // 画像フィールドはプレースホルダーを設定（updateImages が true の場合）
        // UPDATE 時は excludeFromUpdate で既存値を保持するため、INSERT 時のみ適用される
        if (updateImages && imageFields.includes(key)) {
          cleanRecord[key] = PENDING_IMAGE_PLACEHOLDER;
        } else {
          cleanRecord[key] = value;
        }
      }
      // deletedAt を明示的に null として設定（drizzle-orm が DEFAULT を使用するのを防ぐ）
      // CSV に deletedAt 列がない場合も含めて確実に設定
      // drizzle スキーマは camelCase プロパティ名を期待するため deletedAt を使用
      cleanRecord["deletedAt"] = null;
      return cleanRecord;
    });

    // bulkUpsert 実行（画像フィールドは UPDATE SET から除外して既存値を保持）
    const upsertResult = await service.bulkUpsert(
      recordsForUpsert,
      updateImages && imageFields.length > 0
        ? { excludeFromUpdate: imageFields }
        : undefined
    );
    const upsertedRecords = upsertResult.results as Record<string, unknown>[];

    // 画像アップロード、プレースホルダークリーンアップ、deletedAt 復元を統合
    // 各レコードに対して1回の update で処理

    for (let i = 0; i < records.length; i++) {
      const originalRecord = records[i];
      const upsertedRecord = upsertedRecords[i];
      if (!upsertedRecord) continue;

      const recordId = String(upsertedRecord.id);
      const updates: Record<string, unknown> = {};

      // 画像アップロード処理
      if (updateImages && imageFields.length > 0) {
        for (const imageField of imageFields) {
          const csvValue = originalRecord[imageField];

          // CSV に assets/ パスが記載されている場合 → アップロード
          if (typeof csvValue === "string" && csvValue.startsWith("assets/")) {
            const assetPath = csvValue.replace(/^assets\//, "");
            const assetBuffer = assets.get(assetPath);

            if (assetBuffer) {
              const filename = assetPath.split("/").pop() || "image";
              const newUrl = await uploadImage(domain, imageField, filename, assetBuffer);
              updates[imageField] = newUrl;
            } else if (upsertedRecord[imageField] === PENDING_IMAGE_PLACEHOLDER) {
              // アセットが見つからずプレースホルダーが残っている場合は null に
              updates[imageField] = null;
            }
          } else if (upsertedRecord[imageField] === PENDING_IMAGE_PLACEHOLDER) {
            // プレースホルダーが残っている場合は null に変換
            updates[imageField] = null;
          }
        }
      }

      // deletedAt の復元（ソフトデリートされたレコードの場合）
      // drizzle スキーマは camelCase プロパティ名を期待するため deletedAt を使用
      const deletedAtValue = deletedAtMap.get(i);
      if (deletedAtValue !== undefined) {
        updates["deletedAt"] = deletedAtValue;
      }

      // 更新が必要な場合のみ update を実行
      if (Object.keys(updates).length > 0) {
        await service.update(recordId, updates);
      }
    }

    return {
      success: true,
      chunkName,
      recordCount: records.length,
    };
  } catch (error) {
    // エラー情報を構造化して出力
    const errorInfo = extractErrorInfo(error);
    console.error(`[Import] ❌ Chunk ${chunkName} failed:`, JSON.stringify(errorInfo, null, 2));
    return {
      success: false,
      chunkName,
      error: typeof errorInfo.message === "string" ? errorInfo.message : "Unknown error",
    };
  }
}
