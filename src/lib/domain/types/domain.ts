// src/lib/domain/types/domain.ts
// ドメイン情報の型定義

/** ドメイン情報 */
export type DomainInfo = {
  /** ドメインキー（serviceRegistryのキー） */
  key: string;
  /** 表示用ラベル（登録の entity.json の label またはキー） */
  label: string;
  /** テーブル名 */
  tableName: string;
  /** コアドメインかどうか（主の登録の entity.json が無いドメイン） */
  isCore: boolean;
};

/** ドメイン情報（レコード数付き） */
export type DomainInfoWithCount = DomainInfo & {
  /** 現在のレコード数 */
  recordCount: number;
};
