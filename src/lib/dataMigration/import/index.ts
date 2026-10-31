// src/lib/dataMigration/import/index.ts
// サーバーで ZIP を丸ごと受け取る import（POST /api/data-migration/import。UI は使っていない）。
// チャンクごとの処理は importChunk（UI のチャンク import と同じ中核）に任せる。
// 集まりの項目は、どのチャンクにあってもチャンクを 1 つも書く前に DomainError 400 で拒否する（先に全チャンクを調べる）。

import "server-only";
import { toCamelCase } from "@/utils/stringCase.mjs";
import { getDataMigrationConfig } from "../config";
import type { DataMigrationMediaResolver } from "../media";
import type { DataMigrationJunctionResolver, DataMigrationServiceResolver } from "../serviceResolver";
import { assertNoCollectionFields } from "../collectionFields";
import { parseCsv } from "./parseCsv";
import { parseZip } from "./parseZip";
import { importChunk, type FieldTypeInfo } from "./importChunk";

export type { FieldTypeInfo };

export type ImportOptions = {
  /** ドメイン名 */
  domain: string;
  /** ZIP ファイルの Buffer */
  zipBuffer: Buffer;
  /** メディア列を取り込むか（default: true）。false = メディア列に触らない */
  updateImages?: boolean;
  /** フィールド型情報（型変換用） */
  fields?: FieldTypeInfo[];
  /** ファイル台帳の操作（API ルートが実行者で作って注入する） */
  media: DataMigrationMediaResolver;
  /** ドメイン名からサービスを引く（API ルートが src/wiring/domainRegistry.ts の getService を注入する） */
  services: DataMigrationServiceResolver;
  /** 中間表の名前から表を引く（API ルートが src/wiring/domainRegistry.ts の getJunctionTable を注入する） */
  junctionTables: DataMigrationJunctionResolver;
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
 * データをインポート
 */
export async function importData(
  options: ImportOptions
): Promise<ImportResult | ImportError> {
  const { domain, zipBuffer, updateImages = true, fields = [], media, services, junctionTables } = options;
  const config = getDataMigrationConfig();

  // サービスを取得（登録表のキーは camelCase。未登録なら INVALID_DOMAIN）
  const service: any = await services(toCamelCase(domain));
  if (!service) {
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

  // 集まりの項目を含むチャンクがあれば、どのチャンクも書く前に拒否する
  // （importChunk の先頭でも調べるが、後ろのチャンクだけにあると前のチャンクが先に書かれてしまうため）
  assertNoCollectionFields(service, domain, { fields });
  for (const chunk of chunks) {
    const parsed = parseCsv(chunk.csvContent);
    if (parsed.success) assertNoCollectionFields(service, domain, { headers: parsed.headers, records: parsed.records });
  }

  // 各チャンクを処理
  const chunkResults: ChunkResult[] = [];
  let totalRecords = 0;
  let successfulChunks = 0;
  let failedChunks = 0;

  for (const chunk of chunks) {
    console.log(`[Import] Processing ${chunk.chunkName}...`);

    const chunkResult = await importChunk({
      domain,
      chunkName: chunk.chunkName,
      csvContent: chunk.csvContent,
      assets: chunk.assets,
      updateImages,
      fields,
      domainType: "main",
      media,
      services,
      junctionTables,
    });
    const result: ChunkResult = chunkResult.success
      ? { chunkName: chunkResult.chunkName, success: true, recordCount: chunkResult.recordCount }
      : { chunkName: chunkResult.chunkName, success: false, recordCount: 0, error: chunkResult.error };
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
