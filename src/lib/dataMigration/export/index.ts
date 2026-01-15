// src/lib/dataMigration/export/index.ts

import "server-only";
import { getServiceOrThrow } from "@/lib/domain";
import { getDataMigrationConfig, CHUNK_SIZE } from "../config";
import { generateCsv, csvToBuffer } from "./generateCsv";
import { createZip, downloadImage, extractFilename, type ZipEntry } from "./createZip";
import {
  collectExportDomains,
  type ExportDomainInfo,
} from "../relations";
import { db } from "@/lib/drizzle";
import * as schema from "@/registry/schemaRegistry";
import { toPascalCase } from "@/utils/stringCase.mjs";

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
  /** リレーションを含めるか（default: false） */
  includeRelations?: boolean;
};

export type ExportResult = {
  success: true;
  zipBuffer: Buffer;
  filename: string;
  recordCount: number;
  chunkCount: number;
};

/**
 * マニフェストファイルの型（v1.0: 単一ドメイン）
 */
export type ExportManifestV1 = {
  version: "1.0";
  domain: string;
  exportedAt: string;
  totalRecords: number;
  chunkCount: number;
  fields: string[];
};

/**
 * マニフェストのドメイン情報（v1.1）
 */
export type ManifestDomainInfo = {
  name: string;
  type: "main" | "related" | "junction";
  relationType?: "belongsTo" | "belongsToMany";
  relationField?: string;
  sourceField?: string;
  targetField?: string;
  totalRecords: number;
  chunkCount: number;
  fields: string[];
};

/**
 * マニフェストファイルの型（v1.1: 複数ドメイン）
 */
export type ExportManifestV1_1 = {
  version: "1.1";
  exportedAt: string;
  includeRelations: true;
  mainDomain: string;
  domains: ManifestDomainInfo[];
};

/**
 * マニフェストファイルの型（統合）
 */
export type ExportManifest = ExportManifestV1 | ExportManifestV1_1;

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
  const { domain, selectedFields, includeImages, searchParams, imageFields = [], includeRelations = false } = options;

  // リレーションを含める場合は別関数で処理
  if (includeRelations) {
    return exportDataWithRelations(options);
  }

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

/**
 * 中間テーブル名からDrizzleテーブルを取得
 */
function getJunctionTable(tableName: string): unknown {
  // sample_to_sample_tag -> SampleToSampleTagTable
  const tableConstName = `${toPascalCase(tableName)}Table`;
  return (schema as Record<string, unknown>)[tableConstName];
}

/**
 * 単一ドメインのレコードをエクスポート（内部用）
 * @returns { records, chunkCount }
 */
async function exportDomainRecords(
  domainInfo: ExportDomainInfo,
  config: { maxRecordLimit: number },
  includeImages: boolean,
  searchParams?: string
): Promise<{
  success: true;
  records: Record<string, unknown>[];
  chunkCount: number;
  zipEntries: ZipEntry[];
} | {
  success: false;
  error: string;
  code: "TOO_MANY_RECORDS" | "INVALID_DOMAIN" | "EXPORT_ERROR";
  details?: { recordCount?: number; limit?: number };
}> {
  const { domain, type, fields, imageFields } = domainInfo;
  const fieldNames = fields.map((f) => f.name);
  const orderedFields = orderFields(fieldNames);

  const zipEntries: ZipEntry[] = [];
  const allRecords: Record<string, unknown>[] = [];

  // 中間テーブルの場合
  if (type === "junction") {
    const junctionTable = getJunctionTable(domain);
    if (!junctionTable) {
      return {
        success: false,
        error: `Junction table not found: ${domain}`,
        code: "INVALID_DOMAIN",
      };
    }

    // Drizzle で直接クエリ
    const records = await db.select().from(junctionTable as any);
    allRecords.push(...(records as Record<string, unknown>[]));

    // 最大件数チェック
    if (allRecords.length > config.maxRecordLimit) {
      return {
        success: false,
        error: `Record count exceeds limit`,
        code: "TOO_MANY_RECORDS",
        details: {
          recordCount: allRecords.length,
          limit: config.maxRecordLimit,
        },
      };
    }

    // チャンク分割
    for (let i = 0; i < allRecords.length; i += CHUNK_SIZE) {
      const chunkRecords = allRecords.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
      const chunkFolderName = `chunk_${String(chunkIndex).padStart(3, "0")}`;

      const csv = generateCsv(chunkRecords, { fields: orderedFields });
      const csvBuffer = csvToBuffer(csv);

      zipEntries.push({
        path: `${domain}/${chunkFolderName}/data.csv`,
        content: csvBuffer,
      });
    }

    // 0 件の場合も空のチャンクを作成
    if (allRecords.length === 0) {
      const csv = generateCsv([], { fields: orderedFields });
      const csvBuffer = csvToBuffer(csv);
      zipEntries.push({
        path: `${domain}/chunk_001/data.csv`,
        content: csvBuffer,
      });
    }

    const chunkCount = allRecords.length === 0 ? 1 : Math.ceil(allRecords.length / CHUNK_SIZE);
    return { success: true, records: allRecords, chunkCount, zipEntries };
  }

  // 通常ドメインの場合
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

  const hasSearchWithDeleted = typeof service.searchWithDeleted === "function";
  const hasListWithDeleted = typeof service.listWithDeleted === "function";

  if (!hasSearchWithDeleted && !hasListWithDeleted) {
    return {
      success: false,
      error: `Domain ${domain} does not support export`,
      code: "INVALID_DOMAIN",
    };
  }

  const parsedParams = parseSearchParams(searchParams);
  const searchQuery = parsedParams.searchQuery;

  let page = 1;
  let chunkIndex = 1;
  let hasMore = true;

  while (hasMore) {
    let chunkRecords: Record<string, unknown>[];

    if (hasSearchWithDeleted) {
      const result = await service.searchWithDeleted({
        searchQuery,
        limit: CHUNK_SIZE,
        page,
      });
      chunkRecords = result.results || [];
    } else {
      const allRecordsFromList = await service.listWithDeleted();
      const start = (page - 1) * CHUNK_SIZE;
      chunkRecords = allRecordsFromList.slice(start, start + CHUNK_SIZE);
      hasMore = start + CHUNK_SIZE < allRecordsFromList.length;
    }

    if (chunkRecords.length === 0) break;

    allRecords.push(...chunkRecords);

    // 最大件数チェック
    if (allRecords.length > config.maxRecordLimit) {
      return {
        success: false,
        error: `Record count exceeds limit`,
        code: "TOO_MANY_RECORDS",
        details: {
          recordCount: allRecords.length,
          limit: config.maxRecordLimit,
        },
      };
    }

    const chunkFolderName = `chunk_${String(chunkIndex).padStart(3, "0")}`;
    const csv = generateCsv(chunkRecords, { fields: orderedFields });
    const csvBuffer = csvToBuffer(csv);

    zipEntries.push({
      path: `${domain}/${chunkFolderName}/data.csv`,
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
                path: `${domain}/${chunkFolderName}/assets/${imageField}/${filename}`,
                content: imageBuffer,
              });
            }
          }
        }
      }
    }

    if (hasSearchWithDeleted) {
      hasMore = chunkRecords.length === CHUNK_SIZE;
    }

    page++;
    chunkIndex++;
  }

  // 0 件の場合も空のチャンクを作成
  if (allRecords.length === 0) {
    const csv = generateCsv([], { fields: orderedFields });
    const csvBuffer = csvToBuffer(csv);
    zipEntries.push({
      path: `${domain}/chunk_001/data.csv`,
      content: csvBuffer,
    });
  }

  const chunkCount = allRecords.length === 0 ? 1 : chunkIndex - 1;
  return { success: true, records: allRecords, chunkCount, zipEntries };
}

/**
 * リレーションを含めてデータをエクスポート（v1.1）
 */
export async function exportDataWithRelations(
  options: ExportOptions
): Promise<ExportResult | ExportError> {
  const { domain, includeImages, searchParams } = options;
  const config = getDataMigrationConfig();

  try {
    // エクスポート対象ドメイン情報を収集
    const domainInfos = collectExportDomains(domain, true);

    console.log(`[Export] Starting multi-domain export for: ${domain}`);
    console.log(`[Export] Domains: ${domainInfos.map((d) => d.domain).join(", ")}`);

    const zipEntries: ZipEntry[] = [];
    const manifestDomains: ManifestDomainInfo[] = [];
    let totalRecordCount = 0;

    // 各ドメインをエクスポート
    for (const domainInfo of domainInfos) {
      console.log(`[Export] Processing domain: ${domainInfo.domain} (${domainInfo.type})`);

      // メインドメイン以外は検索条件を適用しない
      const domainSearchParams = domainInfo.type === "main" ? searchParams : undefined;

      const result = await exportDomainRecords(
        domainInfo,
        config,
        includeImages,
        domainSearchParams
      );

      if (!result.success) {
        return result;
      }

      zipEntries.push(...result.zipEntries);
      totalRecordCount += result.records.length;

      // マニフェスト用ドメイン情報
      const fieldNames = domainInfo.fields.map((f) => f.name);
      const manifestDomain: ManifestDomainInfo = {
        name: domainInfo.domain,
        type: domainInfo.type,
        totalRecords: result.records.length,
        chunkCount: result.chunkCount,
        fields: orderFields(fieldNames),
      };

      // リレーション情報を追加
      if (domainInfo.relationType) {
        manifestDomain.relationType = domainInfo.relationType;
      }
      if (domainInfo.relationField) {
        manifestDomain.relationField = domainInfo.relationField;
      }
      if (domainInfo.sourceField) {
        manifestDomain.sourceField = domainInfo.sourceField;
      }
      if (domainInfo.targetField) {
        manifestDomain.targetField = domainInfo.targetField;
      }

      manifestDomains.push(manifestDomain);

      console.log(`[Export] Domain ${domainInfo.domain}: ${result.records.length} records, ${result.chunkCount} chunks`);
    }

    // マニフェストファイルを作成（v1.1）
    const manifest: ExportManifestV1_1 = {
      version: "1.1",
      exportedAt: new Date().toISOString(),
      includeRelations: true,
      mainDomain: domain,
      domains: manifestDomains,
    };

    zipEntries.unshift({
      path: "manifest.json",
      content: Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"),
    });

    // ZIP を作成
    const zipBuffer = await createZip(zipEntries);

    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${domain}_with_relations_${timestamp}.zip`;

    console.log(`[Export] Completed: ${totalRecordCount} total records, filename: ${filename}`);

    // メインドメインのレコード数とチャンク数を返す
    const mainDomainInfo = manifestDomains.find((d) => d.type === "main");
    return {
      success: true,
      zipBuffer,
      filename,
      recordCount: mainDomainInfo?.totalRecords || 0,
      chunkCount: mainDomainInfo?.chunkCount || 0,
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
