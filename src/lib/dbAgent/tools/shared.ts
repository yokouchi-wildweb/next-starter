// src/lib/dbAgent/tools/shared.ts
//
// dbAgent ツール共通のユーティリティ。

import { dbAgentConfig } from "../config";

/**
 * クエリ結果をモデルへ返すための JSON 文字列化。
 * BigInt (int8) は文字列へ、Date は toISOString へ変換する。
 */
export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") return v.toString();
    return v;
  });
}

/**
 * モデルに返す文字列をコンテキスト保護のため切り詰める。
 */
export function clampResultText(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= dbAgentConfig.maxResultChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, dbAgentConfig.maxResultChars)}\n…(結果が長すぎるため切り詰めました。集計やLIMITで絞り込んでください)`,
    truncated: true,
  };
}

/** PostgreSQL 識別子 (テーブル名等) の妥当性検証 */
export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && name.length <= 63;
}
