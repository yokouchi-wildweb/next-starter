// src/lib/domain/fields/extractImageFields.ts
// ドメイン設定から画像フィールドを抽出するユーティリティ

import type { DomainConfig } from "../types/domainConfig";

/**
 * ドメイン設定から画像フィールド名を抽出
 * formInput が "mediaUploader" のフィールドを抽出
 *
 * @example
 * const config = getDomainConfig("sample");
 * const imageFields = extractImageFields(config);
 * // ["thumbnail", "images"]
 *
 * NOTE: mediaUploaderMulti (string[]) は対象外。dataMigration の export / import は
 * この関数ではなくサービスの storageFields（Multi を含む）でメディア列を決める（src/lib/dataMigration/README.md）。
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
