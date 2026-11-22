// src/domains/core/messaging/services/server/admin/textSearch.ts
//
// 管理の一覧の文字検索(送信の件名・テンプレートの文面)の SQL の部品。jsonb の文字列の値を jsonpath の like_regex で探す。
// - 検索の字はそのまま(flag "q" = 正規表現として読まない)・大文字小文字を区別しない(flag "i")
// - 字は JSON の文字列のリテラルにして path に入れ、path は bind の値として渡す(SQL に字を組み込まない)
// - 鍵(欄の名前・送信チャンネルの鍵)は探さない: 値の文字列だけ

import { sql, type SQL } from "drizzle-orm";

/** jsonb の中の文字列の値のどれかが text を含むか。scope = "children"(1 段目の値だけ: 送信チャンネルごとの件名)/ "deep"(入れ子の全部: 欄の中身) */
export function jsonbTextContains(column: SQL | { getSQL(): SQL }, text: string, scope: "children" | "deep"): SQL {
  const items = scope === "children" ? "$.*" : "$.**";
  const path = `strict ${items} ? (@.type() == "string" && @ like_regex ${JSON.stringify(text)} flag "iq")`;
  return sql`jsonb_path_exists(${column}, ${path}::jsonpath)`;
}

/** ILIKE の % _ \ を字として読ませる(部分一致の形 %…% にする) */
export function ilikeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
