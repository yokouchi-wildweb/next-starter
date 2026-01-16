// src/lib/domain/fields/extractImageFields.ts
// ドメイン設定から画像フィールドを抽出するユーティリティ

import type { DomainConfig } from "../config";

/**
 * ドメイン設定から画像フィールド名を抽出
 * formInput が "mediaUploader" のフィールドを抽出
 *
 * @example
 * const config = getDomainConfig("sample");
 * const imageFields = extractImageFields(config);
 * // ["thumbnail", "images"]
 */
export function extractImageFields(config: DomainConfig): string[] {
  return config.fields
    .filter((field) => field.formInput === "mediaUploader")
    .map((field) => field.name);
}

/**
 * ドメイン設定が画像フィールドを持つかどうかを判定
 */
export function hasImageFields(config: DomainConfig): boolean {
  return extractImageFields(config).length > 0;
}
