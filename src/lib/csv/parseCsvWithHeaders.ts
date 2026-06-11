// src/lib/csv/parseCsvWithHeaders.ts
//
// ヘッダー必須の CSV を共通方式でパースする小さなヘルパー。
//
// 設計方針:
// - 各ドメインの CSV 取り込み（伝票番号一括取込・銀行振込レビュー一括判定 等）で
//   毎回書いていた「BOM 除去 / CRLF 正規化 / csv-parse の columns:true / 必須ヘッダー検証」
//   を 1 か所に集約し、結果型も共通化することで取り込みパイプラインの行ごとの処理だけに
//   各ドメインが集中できるようにする。
// - 行値の型は `Record<string, string>`。csv-parse の columns:true の戻り値に合わせている。
//   セル値の trim や数値変換などは「行ごとの処理」側で行う想定（この層では加工しない）。

import { parse as parseCsvSync } from "csv-parse/sync";

/**
 * パース結果。
 * - ok=true: ヘッダー検証通過。records はヘッダー行を除いた各行を `{ 列名: 値 }` で持つ
 * - ok=false: パース失敗 or 必須ヘッダー欠落。error にユーザー向けメッセージが入る
 */
export type ParseCsvResult =
  | { ok: true; records: Array<Record<string, string>> }
  | { ok: false; error: string };

/**
 * ヘッダー必須の CSV をパースする。
 *
 * 仕様:
 * - 先頭の BOM (U+FEFF) を除去（Excel 出力等で混入するケース）
 * - CRLF / CR を LF に正規化
 * - csv-parse/sync で `columns: true` 読み（先頭行をヘッダーとして利用）
 * - `requiredHeaders` を全て含むかを検証（不足時は ok:false でメッセージ返却）
 * - 空ファイル（データ行 0 件）はパース成功扱い（呼び出し側で「データ行なし」を判断）
 *
 * @param csvText  アップロード／貼り付けされた CSV テキスト
 * @param requiredHeaders  必須ヘッダー名の配列。1 つでも欠けていれば ok:false
 */
export function parseCsvWithHeaders(
  csvText: string,
  requiredHeaders: ReadonlyArray<string>,
): ParseCsvResult {
  const normalized = csvText
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  let records: Array<Record<string, string>>;
  try {
    records = parseCsvSync(normalized, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: false,
    }) as Array<Record<string, string>>;
  } catch (error) {
    return {
      ok: false,
      error: `CSVのパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // ヘッダー検証は「データ行が 1 行以上ある場合」にのみ可能
  // （csv-parse の columns:true は records が 0 件のときヘッダー情報を返さないため）。
  // 0 件のケースは呼び出し側で「データ行がありません」を判定する想定で OK を返す。
  if (records.length > 0) {
    const headers = Object.keys(records[0]);
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `CSVヘッダーが不足しています: ${missing.join(", ")}`,
      };
    }
  }

  return { ok: true, records };
}
