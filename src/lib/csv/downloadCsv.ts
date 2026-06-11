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

/** CSV の 1 セルを RFC 4180 準拠でエスケープする */
function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * ヘッダー + 行データから CSV 文字列を生成する純関数。
 *
 * - 空 rows でも有効な CSV（ヘッダーのみ）を返す。テンプレート用途で使用可能。
 * - 改行は LF 固定。Excel / Google Sheets ともに認識可能。
 *
 * @param headers  ヘッダー列名の配列
 * @param rows     各行のセル値配列。長さは headers と一致させる前提（揃えない場合の補完はしない）
 */
export function buildCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((r) => r.map(escapeCsvCell).join(","));
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
