// src/lib/dataMigration/import/importChunk.ts

// メディア列（サービスの storageFields）は bulkUpsert で書かない。値は TX の外で先に解決し（mediaValues.ts）、
// チャンクごとの 1 つの TX の中で bulkUpsert（メディア列を外す）→ 行ごとの update（binding が attach / detach）の順に書く。
// 1 行でも失敗すればチャンク全体を巻き戻す。
// 集まりの項目（サービスの collectionFields）を含むチャンクは、メディアの解決・書き込みより前に DomainError 400 で拒否する。

import "server-only";
import type { CrudStorageField } from "@/lib/crud/storageIntegration/types";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { parseCsv } from "./parseCsv";
import { db } from "@/lib/drizzle";
import type { DataMigrationMediaResolver } from "../media";
import type { DataMigrationJunctionResolver, DataMigrationServiceResolver } from "../serviceResolver";
import { MediaValueError, resolveMediaRow } from "./mediaValues";
import { assertNoCollectionFields } from "../collectionFields";

export type FieldTypeInfo = {
  name: string;
  fieldType?: string;
};

export type ImportChunkOptions = {
  /** ドメイン名 */
  domain: string;
  /** チャンク名 */
  chunkName: string;
  /** CSV コンテンツ（文字列） */
  csvContent: string;
  /** ZIP に同梱されたファイル（`assets/` 以降のパス → 中身）。サーバー ZIP 経路で使う */
  assets?: Map<string, Uint8Array>;
  /** 今回クライアントがアップロードした ref（CSV の `assets/…` を置き換えたもの） */
  uploadedRefs?: Iterable<string>;
  /**
   * メディア列を取り込むか（default: true）。false = メディア列に触らない（CSV の値は無視）。
   * どの列がメディア列かはサービスの storageFields が正本（クライアントの申告は使わない）
   */
  updateImages?: boolean;
  /** ファイル台帳の操作（API ルートが実行者で作って注入する） */
  media: DataMigrationMediaResolver;
  /** ドメイン名からサービスを引く（API ルートが src/wiring/domainRegistry.ts の getService を注入する） */
  services: DataMigrationServiceResolver;
  /** 中間表の名前から表を引く（API ルートが src/wiring/domainRegistry.ts の getJunctionTable を注入する） */
  junctionTables: DataMigrationJunctionResolver;
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
  junctionTables: DataMigrationJunctionResolver;
}): Promise<ImportChunkResult> {
  const { domain, chunkName, csvContent, junctionTables } = options;

  // 中間テーブルを取得
  const junctionTable = await junctionTables(domain);
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

/** 書き込み先の既存行（削除済みも含む）。無ければ null */
async function findExisting(service: any, id: string): Promise<Record<string, unknown> | null> {
  const finder = typeof service.getWithDeleted === "function" ? service.getWithDeleted : service.get;
  const row = await finder.call(service, id);
  return (row as Record<string, unknown> | undefined) ?? null;
}

/**
 * チャンク単位でデータをインポート
 */
export async function importChunk(
  options: ImportChunkOptions
): Promise<ImportChunkResult> {
  const { domain, chunkName, csvContent, domainType, services, junctionTables } = options;

  // 中間テーブルの場合は直接 DB 挿入
  if (domainType === "junction") {
    return importJunctionChunk({ domain, chunkName, csvContent, junctionTables });
  }

  // サービスを取得（登録表のキーは camelCase）。import を許すかは API ルートが domainEntry.ts の access（import）で判定済み
  // （旧: domain.json の useImportExport を lib で見ていた。今は dc:generate が useImportExport を access の export / import に写す）
  const service: any = await services(toCamelCase(domain));
  if (!service) {
    return {
      success: false,
      chunkName,
      error: `Invalid domain: ${domain}`,
    };
  }

  return importServiceChunk(service, options);
}

/**
 * 解決済みのサービスにチャンクを取り込む（importChunk の本体。実 DB テストは専用表のサービスを直接渡す）
 */
export async function importServiceChunk(
  service: any,
  options: Omit<ImportChunkOptions, "domain" | "domainType" | "services" | "junctionTables"> & { domain?: string },
): Promise<ImportChunkResult> {
  const {
    domain = "",
    chunkName,
    csvContent,
    assets = new Map<string, Uint8Array>(),
    uploadedRefs = [],
    updateImages = true,
    fields = [],
    media,
  } = options;

  // bulkUpsert が存在するか確認
  if (typeof service.bulkUpsert !== "function") {
    return {
      success: false,
      chunkName,
      error: `Domain ${domain} does not support import (no bulkUpsert)`,
    };
  }

  // CSV パース
  const csvResult = parseCsv(csvContent);

  // 集まりの項目は取り込まない: DB を変える前（メディアの写し・アップロードより前）に 400 で投げる
  if (csvResult.success) {
    assertNoCollectionFields(service, domain, { headers: csvResult.headers, records: csvResult.records, fields });
  }

  try {
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

    // メディア列（storage オプションの列）。bulkUpsert では常に外す
    const storageFields: readonly CrudStorageField[] = service.storageFields ?? [];
    const mediaNames = new Set(storageFields.map((field) => field.name));
    const importedMediaFields = updateImages ? storageFields : [];

    // フィールド型情報を取得
    const { arrayFields, dateFields, numberFields } = getFieldTypes(fields);

    // 型変換を適用してレコードを準備（メディア列は外す）
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
        // メディア列は bulkUpsert で書かない（行ごとの update で binding を通す）
        if (mediaNames.has(key)) continue;
        cleanRecord[key] = value;
      }
      // deletedAt を明示的に null として設定（drizzle-orm が DEFAULT を使用するのを防ぐ）
      // CSV に deletedAt 列がない場合も含めて確実に設定
      // drizzle スキーマは camelCase プロパティ名を期待するため deletedAt を使用
      cleanRecord["deletedAt"] = null;
      return cleanRecord;
    });

    // メディア列の値を TX の外で先に解決する（putFromServer / copy は時間がかかるため）
    const mediaUpdates: (Record<string, unknown> | null)[] = [];
    if (importedMediaFields.some((field) => records.some((record) => field.name in record))) {
      const uploaded = new Set(uploadedRefs);
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const id = typeof record.id === "string" && record.id.trim() !== "" ? record.id.trim() : null;
        const existing = id ? await findExisting(service, id) : null;
        const resolved = await resolveMediaRow({
          rowNumber: i + 1,
          record,
          existing,
          scopeRow: { ...(existing ?? {}), ...recordsForUpsert[i] },
          fields: importedMediaFields,
          assets,
          uploadedRefs: uploaded,
          media,
        });
        mediaUpdates.push(Object.keys(resolved).length > 0 ? resolved : null);
      }
    }

    // チャンクの書き込みは 1 つの TX（1 行でも失敗すればチャンク全体を巻き戻す）
    await db.transaction(async (tx) => {
      // bulkUpsert 実行（メディア列は UPDATE SET からも外し、既存の値を保つ）
      const upsertResult = await service.bulkUpsert(
        recordsForUpsert,
        mediaNames.size > 0 ? { excludeFromUpdate: [...mediaNames] } : undefined,
        tx,
      );
      const upsertedRecords = upsertResult.results as Record<string, unknown>[];

      // メディア列の書き込みと deletedAt の復元を、各レコード 1 回の update で行う
      // （メディア列を含む update では binding が同じ TX で attach / detach する）
      for (let i = 0; i < records.length; i++) {
        const upsertedRecord = upsertedRecords[i];
        if (!upsertedRecord) continue;

        const updates: Record<string, unknown> = { ...(mediaUpdates[i] ?? {}) };

        // deletedAt の復元（ソフトデリートされたレコードの場合）
        // drizzle スキーマは camelCase プロパティ名を期待するため deletedAt を使用
        const deletedAtValue = deletedAtMap.get(i);
        if (deletedAtValue !== undefined) {
          updates["deletedAt"] = deletedAtValue;
        }

        // 更新が必要な場合のみ update を実行
        if (Object.keys(updates).length > 0) {
          await service.update(String(upsertedRecord.id), updates, tx);
        }
      }
    });

    return {
      success: true,
      chunkName,
      recordCount: records.length,
    };
  } catch (error) {
    if (error instanceof MediaValueError) {
      console.error(`[Import] ❌ Chunk ${chunkName} failed: ${error.message}`);
      return { success: false, chunkName, error: error.message };
    }
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
