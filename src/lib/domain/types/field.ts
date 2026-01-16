// src/lib/domain/types/field.ts
// フィールド関連の型定義

/** ドメインフィールド情報 */
export type DomainFieldInfo = {
  name: string;
  label: string;
  fieldType: string;
  formInput?: string;
};
