// src/lib/dataMigration/components/DataMigrationModal/types.ts
// データ移行モーダル関連の型定義

import type { ExportField } from "../ExportSettingsModal";

// ----------------------------------------------------------------------------
// インポート処理関連
// ----------------------------------------------------------------------------

/** チャンク単位のインポート結果 */
export type ChunkResult = {
  chunkName: string;
  domain: string;
  success: boolean;
  recordCount: number;
  error?: string;
};

/** ドメイン単位のインポート結果 */
export type DomainImportResult = {
  domain: string;
  totalRecords: number;
  successfulChunks: number;
  failedChunks: number;
};

/** インポート全体の結果 */
export type ImportResultData = {
  totalRecords: number;
  successfulChunks: number;
  failedChunks: number;
  chunkResults: ChunkResult[];
  domainResults?: DomainImportResult[];
  isMultiDomain?: boolean;
};

/** インポート進捗状態 */
export type ImportProgress = {
  currentDomain?: string;
  currentDomainIndex?: number;
  totalDomains?: number;
  currentChunk: number;
  totalChunks: number;
  currentChunkName: string;
};

// ----------------------------------------------------------------------------
// マニフェスト
// ----------------------------------------------------------------------------

/** マニフェスト v1.0（単一ドメイン） */
export type ManifestV1 = {
  version: "1.0";
  domain: string;
  totalRecords: number;
  chunkCount: number;
};

/** マニフェストのドメイン情報（v1.1） */
export type ManifestDomainInfo = {
  name: string;
  type: "main" | "related" | "junction" | "hasMany";
  totalRecords: number;
  chunkCount: number;
};

/** マニフェスト v1.1（複数ドメイン） */
export type ManifestV1_1 = {
  version: "1.1";
  mainDomain: string;
  domains: ManifestDomainInfo[];
};

// ----------------------------------------------------------------------------
// コンポーネント Props
// ----------------------------------------------------------------------------

/** hasMany ドメイン情報 */
export type HasManyDomainInfo = {
  /** ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
};

/** DataMigrationModal の Props */
export type DataMigrationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ドメイン名（API 呼び出し用） */
  domain: string;
  /** フィールド情報 */
  fields: ExportField[];
  /** ドメインの表示名 */
  domainLabel: string;
  /** 検索パラメータ（URL クエリ文字列形式） */
  searchParams?: string;
  /** インポート成功時のコールバック */
  onImportSuccess?: () => void;
  /** リレーションが存在するか（エクスポート時に「リレーションを含める」オプションを表示） */
  hasRelations?: boolean;
  /** hasMany ドメイン情報（エクスポート時に選択可能） */
  hasManyDomains?: HasManyDomainInfo[];
};

/** ExportTabContent の Props */
export type ExportTabContentProps = {
  domain: string;
  fields: ExportField[];
  searchParams?: string;
  onOpenChange: (open: boolean) => void;
  hasRelations?: boolean;
  hasManyDomains?: HasManyDomainInfo[];
};

/** ImportTabContent の Props */
export type ImportTabContentProps = {
  domain: string;
  imageFields: string[];
  fields: ExportField[];
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
};

// Re-export for convenience
export type { ExportField };
