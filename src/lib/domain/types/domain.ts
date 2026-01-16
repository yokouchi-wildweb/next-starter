// src/lib/domain/types/domain.ts
// ドメイン情報の型定義

/** ドメイン情報 */
export type DomainInfo = {
  /** ドメインキー（serviceRegistryのキー） */
  key: string;
  /** 表示用ラベル（domain.jsonのlabelまたはキー） */
  label: string;
  /** テーブル名 */
  tableName: string;
  /** コアドメインかどうか（domain.jsonが存在しないドメイン） */
  isCore: boolean;
};

/** ドメイン情報（レコード数付き） */
export type DomainInfoWithCount = DomainInfo & {
  /** 現在のレコード数 */
  recordCount: number;
};
