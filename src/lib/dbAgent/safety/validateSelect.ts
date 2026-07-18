// src/lib/dbAgent/safety/validateSelect.ts
//
// run_query に渡された SQL の「単文 SELECT のみ」検証 (アプリ層の防御)。
//
// これは多層防御の1層目であり、最終防衛線は読取専用 DB ロール
// (readonlyDb.ts) である。ここでの静的検証は
//  - 明白な書き込み・DDL の早期拒否 (モデルへの明確なフィードバック)
//  - 複文実行の禁止
// を目的とし、完璧な SQL パースは目指さない (拒否しすぎない範囲で保守的に)。

import { DB_AGENT_CONFIG } from "@/config/app/ai-agent.config";

export type ValidateSelectResult =
  | { ok: true; query: string }
  | { ok: false; reason: string };

/**
 * 文字列リテラル・識別子・コメントを除去した「構造部分」だけを返す。
 * キーワード検査を文字列内容に誤反応させないための前処理。
 */
function stripLiteralsAndComments(sql: string): string {
  let result = "";
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    // 行コメント
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? len : end + 1;
      continue;
    }
    // ブロックコメント (ネスト対応)
    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < len && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          i += 2;
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      continue;
    }
    // ドル引用文字列 ($$...$$ / $tag$...$tag$)
    if (ch === "$") {
      const tagMatch = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const end = sql.indexOf(tag, i + tag.length);
        i = end === -1 ? len : end + tag.length;
        continue;
      }
    }
    // 文字列リテラル
    if (ch === "'") {
      i++;
      while (i < len) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2; // エスケープされた ''
        } else if (sql[i] === "'") {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }
    // 引用識別子
    if (ch === '"') {
      i++;
      while (i < len) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          i += 2;
        } else if (sql[i] === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * 書き込み・DDL・危険操作のキーワード (構造部分に単語として現れたら拒否)。
 * SELECT INTO (テーブル作成) を塞ぐため into も含める。
 */
const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "merge",
  "truncate",
  "drop",
  "alter",
  "create",
  "grant",
  "revoke",
  "copy",
  "vacuum",
  "reindex",
  "cluster",
  "refresh",
  "listen",
  "notify",
  "prepare",
  "execute",
  "deallocate",
  "declare",
  "fetch",
  "lock",
  "set",
  "reset",
  "call",
  "do",
  "into",
];

const FORBIDDEN_PATTERN = new RegExp(
  `\\b(${FORBIDDEN_KEYWORDS.join("|")})\\b`,
  "i",
);

/**
 * 単文 SELECT (または WITH ... SELECT) であることを検証する。
 *
 * 戻り値の query は末尾セミコロンを除去した実行用 SQL。
 */
export function validateSelect(rawQuery: string): ValidateSelectResult {
  const query = rawQuery.trim().replace(/;\s*$/, "");

  if (!query) {
    return { ok: false, reason: "SQL が空です。" };
  }
  if (query.length > DB_AGENT_CONFIG.maxQueryChars) {
    return {
      ok: false,
      reason: `SQL が長すぎます (最大 ${DB_AGENT_CONFIG.maxQueryChars} 文字)。`,
    };
  }

  const structural = stripLiteralsAndComments(query);

  // 複文禁止 (リテラル外のセミコロン)
  if (structural.includes(";")) {
    return { ok: false, reason: "複数ステートメントは実行できません。1文の SELECT のみ許可されます。" };
  }

  // SELECT / WITH 始まりのみ許可
  const head = structural.trimStart().slice(0, 16).toLowerCase();
  if (!head.startsWith("select") && !head.startsWith("with")) {
    return {
      ok: false,
      reason: "SELECT 文 (または WITH ... SELECT) のみ実行できます。",
    };
  }

  // 書き込み・DDL キーワード禁止 (データ変更 CTE: WITH x AS (INSERT ...) も塞ぐ)
  const forbidden = FORBIDDEN_PATTERN.exec(structural);
  if (forbidden) {
    return {
      ok: false,
      reason: `読取専用のため "${forbidden[1].toUpperCase()}" を含む SQL は実行できません。`,
    };
  }

  return { ok: true, query };
}
