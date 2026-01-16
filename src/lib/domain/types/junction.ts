// src/lib/domain/types/junction.ts
// 中間テーブル関連の型定義

/** belongsToMany の中間テーブル情報 */
export type JunctionTableInfo = {
  /** 中間テーブル名（snake_case: sample_to_sample_tag） */
  tableName: string;
  /** Drizzle テーブル定数名（PascalCase: SampleToSampleTagTable） */
  tableConstName: string;
  /** ソースドメイン名（snake_case） */
  sourceDomain: string;
  /** ターゲットドメイン名（snake_case） */
  targetDomain: string;
  /** ソースフィールド名（camelCase: sampleId） */
  sourceField: string;
  /** ターゲットフィールド名（camelCase: sampleTagId） */
  targetField: string;
};
