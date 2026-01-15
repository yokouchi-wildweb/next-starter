// src/lib/dataMigration/config.ts

import { APP_FEATURES } from "@/config/app/app-features.config";

/**
 * 内部処理のチャンクサイズ（固定値、変更不可）
 * 画像フィールドの数やメモリ使用量を考慮して設定
 */
export const CHUNK_SIZE = 100;

/**
 * データマイグレーションのデフォルト設定
 */
export const DATA_MIGRATION_DEFAULTS = {
  /** 最大レコード数制限 */
  maxRecordLimit: 1000,
} as const;

export type DataMigrationConfig = {
  chunkSize: number;
  maxRecordLimit: number;
};

/**
 * データマイグレーション設定を取得
 * maxRecordLimit のみ app-features.config.ts で上書き可能
 * chunkSize は内部処理用の固定値
 */
export function getDataMigrationConfig(): DataMigrationConfig {
  const appConfig = APP_FEATURES.dataMigration;
  return {
    chunkSize: CHUNK_SIZE,
    maxRecordLimit: appConfig?.maxRecordLimit ?? DATA_MIGRATION_DEFAULTS.maxRecordLimit,
  };
}
