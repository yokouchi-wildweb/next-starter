// src/lib/domain/types/relation.ts
// リレーション関連の型定義

/** リレーションタイプ */
export type RelationType = "belongsTo" | "belongsToMany";

/** リレーション情報（belongsTo, belongsToMany 用） */
export type RelationInfo = {
  /** 関連先ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** フィールド名（belongsTo: 外部キー, belongsToMany: 配列フィールド） */
  fieldName: string;
  /** フィールドタイプ */
  fieldType: string;
  /** リレーションタイプ */
  relationType: RelationType;
  /** 必須フラグ */
  required: boolean;
  /** belongsToMany の持つ側が名指す結びの登録名(D354)。反対側(読むだけの参照)と belongsTo は無し */
  through?: string;
};

/** hasMany リレーション情報 */
export type HasManyRelationInfo = {
  /** 子ドメイン名（snake_case） */
  domain: string;
  /** ラベル */
  label: string;
  /** 子ドメイン側の外部キーフィールド名 */
  fieldName: string;
};
