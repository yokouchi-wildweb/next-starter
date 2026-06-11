// src/lib/csv/downloadCsv.ts
//
// CSV 文字列の生成と、ブラウザでのダウンロード（Blob → <a download>）の共通化。
//
// 設計方針:
// - サーバ／クライアント双方から呼ばれる可能性を考慮し、`buildCsv` は純関数として
//   切り出す（DOM API を触らない）。`downloadCsv` だけがブラウザ依存。
// - Excel での文字化けを避けるため、ダウンロード時は UTF-8 BOM を必ず付与する。
// - エスケープ規則は RFC 4180 準拠（`,` `"` `\n` を含むセルはダブルクォートで囲み、
//   セル内の `"` を `""` にエスケープ）。
// - フォーミュラインジェクション対策（既定で有効）: `=` `+` `-` `@` タブ CR で始まる
//   セルに `'` を前置し、Excel / Google Sheets での数式解釈を防ぐ。外部入力
//   （ユーザー名・振込人名等）を含む CSV を管理者が表計算ソフトで開く用途を想定。

/** CSV の 1 セルを RFC 4180 準拠でエスケープする */
function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 表計算ソフトが数式として解釈し得る先頭文字 */
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * フォーミュラインジェクション対策として、数式として解釈され得るセルに `'` を前置する。
 * 正規の数値表現（-1500, +3.14 等）は数式にならないため対象外とし、金額列等が
 * `'` で汚れないようにする。
 */
function sanitizeFormulaCell(value: string): string {
  if (value.length === 0 || !FORMULA_TRIGGER_CHARS.has(value[0])) return value;
  if (/^[+-]?\d+(\.\d+)?$/.test(value)) return value;
  return `'${value}`;
}

export type BuildCsvOptions = {
  /**
   * フォーミュラインジェクション対策（危険な先頭文字を持つセルへの `'` 前置）を行うか。
   * 既定 true。`'` はデータの一部として残るため、人間が表計算ソフトで開く用途では
   * 既定のまま、機械連携用エクスポート（値の完全一致が必要）でのみ false にする。
   */
  sanitizeFormulas?: boolean;
};

/**
 * ヘッダー + 行データから CSV 文字列を生成する純関数。
 *
 * - 空 rows でも有効な CSV（ヘッダーのみ）を返す。テンプレート用途で使用可能。
 * - 改行は LF 固定。Excel / Google Sheets ともに認識可能。
 *
 * @param headers  ヘッダー列名の配列
 * @param rows     各行のセル値配列。長さは headers と一致させる前提（揃えない場合の補完はしない）
 * @param options  生成オプション（フォーミュラ無害化の切替等）
 */
export function buildCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
  options: BuildCsvOptions = {},
): string {
  const sanitize = options.sanitizeFormulas ?? true;
  const toCell = (value: string) =>
    escapeCsvCell(sanitize ? sanitizeFormulaCell(value) : value);
  const headerLine = headers.map(toCell).join(",");
  const bodyLines = rows.map((r) => r.map(toCell).join(","));
  return [headerLine, ...bodyLines].join("\n");
}

/**
 * CSV 文字列を BOM 付き UTF-8 のファイルとしてブラウザでダウンロードさせる。
 *
 * - BOM を付けることで Excel で開いたときに文字化けしない（macOS 版含む）
 * - 呼び出し前にユーザージェスチャー（クリック等）を起点にすること（ブラウザのDL制限）
 */
export function downloadCsv(params: {
  /** ダウンロード時のファイル名（拡張子含む） */
  filename: string;
  /** CSV 本文（buildCsv で生成したもの等） */
  csvContent: string;
}): void {
  const { filename, csvContent } = params;
  const bom = "﻿";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ヘッダー行のみの空テンプレ CSV をダウンロードさせるショートカット。
 * 取り込みダイアログから「ひな形DL」ボタンで使う想定。
 */
export function downloadCsvTemplate(params: {
  filename: string;
  headers: ReadonlyArray<string>;
}): void {
  downloadCsv({
    filename: params.filename,
    csvContent: buildCsv(params.headers, []),
  });
}

/**
 * ファイル名サフィックス用の YYYYMMDD 文字列。
 * ローカルタイムゾーン基準（管理者がDLした日付の感覚と合わせるため）。
 */
export function formatYmd(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
