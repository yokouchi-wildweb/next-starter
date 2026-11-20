// src/lib/dataMigration/server.ts
//
// データ移行のサーバーの入口(@/lib/dataMigration/server)。API ルート(src/app/api/data-migration)が読む。
// 管理画面の部品・フックは主な入口 @/lib/dataMigration にある(client の部品をルートの読み込みに入れないために分ける)。

import "server-only";

export { exportData, exportDataWithRelations } from "./export";
export type {
  ExportError,
  ExportManifest,
  ExportManifestV1,
  ExportManifestV1_1,
  ExportOptions,
  ExportResult,
  ManifestDomainInfo,
} from "./export";
export { importData } from "./import";
export type { ChunkResult, ImportError, ImportOptions, ImportResult } from "./import";
export { importChunk, importServiceChunk } from "./import/importChunk";
export type { FieldTypeInfo, ImportChunkOptions, ImportChunkResult } from "./import/importChunk";
export { MEDIA_SKIPPED_EXAMPLES_HEADER, MEDIA_SKIPPED_HEADER } from "./media";
export type { DataMigrationMediaResolver, MediaSkipped } from "./media";
export type { DataMigrationJunctionResolver, DataMigrationServiceResolver } from "./serviceResolver";
export { collectionFieldsOf } from "./collectionFields";
