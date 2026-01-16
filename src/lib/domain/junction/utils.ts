// src/lib/domain/junction/utils.ts
// 中間テーブル（junction table）に関するユーティリティ

import { toCamelCase, toSnakeCase } from "@/utils/stringCase.mjs";
import type { JunctionTableInfo } from "../types";

export type { JunctionTableInfo };

/**
 * 中間テーブル名を解決
 * 命名規則: {sourceDomain}_to_{targetDomain}
 *
 * @example
 * resolveJunctionTableName("sample", "sample_tag") // "sample_to_sample_tag"
 */
export function resolveJunctionTableName(
  sourceDomain: string,
  targetDomain: string
): string {
  return `${toSnakeCase(sourceDomain)}_to_${toSnakeCase(targetDomain)}`;
}

/**
 * 中間テーブルのフィールド名を解決
 * 命名規則: {domain}Id (camelCase)
 *
 * @example
 * resolveJunctionFieldName("sample_tag") // "sampleTagId"
 */
export function resolveJunctionFieldName(domain: string): string {
  return `${toCamelCase(domain)}Id`;
}

/**
 * 中間テーブル情報を取得
 *
 * @example
 * getJunctionTableInfo("sample", "sample_tag")
 * // {
 * //   tableName: "sample_to_sample_tag",
 * //   tableConstName: "SampleToSampleTagTable",
 * //   sourceDomain: "sample",
 * //   targetDomain: "sample_tag",
 * //   sourceField: "sampleId",
 * //   targetField: "sampleTagId"
 * // }
 */
export function getJunctionTableInfo(
  sourceDomain: string,
  targetDomain: string
): JunctionTableInfo {
  const sourceDomainSnake = toSnakeCase(sourceDomain);
  const targetDomainSnake = toSnakeCase(targetDomain);
  const tableName = resolveJunctionTableName(sourceDomainSnake, targetDomainSnake);

  // snake_case -> PascalCase 変換して Table を付与
  const toPascalCase = (str: string) =>
    str
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

  return {
    tableName,
    tableConstName: `${toPascalCase(tableName)}Table`,
    sourceDomain: sourceDomainSnake,
    targetDomain: targetDomainSnake,
    sourceField: resolveJunctionFieldName(sourceDomainSnake),
    targetField: resolveJunctionFieldName(targetDomainSnake),
  };
}

/**
 * 中間テーブル名かどうかを判定
 * xxx_to_yyy 形式なら true
 */
export function isJunctionTableName(name: string): boolean {
  return /_to_/.test(name);
}

/**
 * 中間テーブル名からソース・ターゲットドメインを抽出
 *
 * @example
 * parseJunctionTableName("sample_to_sample_tag")
 * // { sourceDomain: "sample", targetDomain: "sample_tag" }
 */
export function parseJunctionTableName(tableName: string): {
  sourceDomain: string;
  targetDomain: string;
} | null {
  const match = tableName.match(/^(.+)_to_(.+)$/);
  if (!match) return null;
  return {
    sourceDomain: match[1],
    targetDomain: match[2],
  };
}
