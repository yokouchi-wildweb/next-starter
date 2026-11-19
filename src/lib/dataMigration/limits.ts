// src/lib/dataMigration/limits.ts

import { dataMigrationConfig } from "./config";

/**
 * 内部処理のチャンクサイズ（固定値、変更不可）
 * 画像フィールドの数やメモリ使用量を考慮して設定
 */
export const CHUNK_SIZE = 100;

export type DataMigrationConfig = {
  chunkSize: number;
  maxRecordLimit: number;
};

/**
 * データマイグレーション設定を取得
 * maxRecordLimit だけ上書き src/config/lib/dataMigration.config.ts で変えられる(既定 ./config.ts)
 * chunkSize は内部処理用の固定値
 */
export function getDataMigrationConfig(): DataMigrationConfig {
  return {
    chunkSize: CHUNK_SIZE,
    maxRecordLimit: dataMigrationConfig.maxRecordLimit,
  };
}
