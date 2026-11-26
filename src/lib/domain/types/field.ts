// src/lib/domain/types/field.ts
// フィールド関連の型定義

import type { DomainField } from "./domainField";

/** ドメインフィールド情報(entity.json の項目のうち名前・ラベル・型・入力種別。リレーションの列も同じ形で並ぶ) */
export type DomainFieldInfo = Pick<DomainField, "name" | "label" | "fieldType" | "formInput">;
