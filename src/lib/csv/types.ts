// src/lib/csv/types.ts
//
// CSV 一括取り込み API のレスポンス形を共通化するための基底型。
//
// 設計方針:
// - 「行ごとの結果配列 + 全体の致命的エラー + 全件 OK 判定」という骨格は、伝票番号CSV取込
//   や今後の銀行振込レビューCSV取込など、ドメインを跨いで同じ形になる。骨格だけを基底型
//   として定義し、ドメイン固有のフィールド（解決済みID・正規化後の値など）は基底型を
//   `&` で拡張する形を推奨する。
// - dryRun 対応の API に共通する「OK 行数」「実行時に書き込まれた件数」等のカウンタは
//   ドメインによってラベル（updatedCount / confirmedCount / needsCheckCount 等）が変わる
//   ため基底には含めない。各ドメイン側で必要な集計フィールドを足す。

/** 取り込み 1 行ごとのステータス */
export type CsvImportRowStatus = "ok" | "error";

/**
 * 取り込み 1 行ごとの結果の基底。
 *
 * 各ドメインは以下のように拡張する:
 *   type MyRowResult = CsvImportRowResultBase & {
 *     resolvedId: string | null;
 *     normalizedAmount: number | null;
 *   };
 */
export type CsvImportRowResultBase = {
  /** CSV の行番号（ヘッダー除く、1 始まり） */
  rowIndex: number;
  status: CsvImportRowStatus;
  /** ユーザー向けメッセージ（status=error のときに入る。OK 行で補足を入れたければ任意） */
  message: string | null;
};

/**
 * 取り込み API レスポンスの基底。
 * `TRow` は `CsvImportRowResultBase` を継承した行型。
 *
 * 各ドメイン側で必要な集計を足す:
 *   type MyResponse = CsvImportResponseBase<MyRowResult> & {
 *     updatedCount: number;
 *   };
 */
export type CsvImportResponseBase<TRow extends CsvImportRowResultBase> = {
  /** 全件成功したかどうか（1 件でも error があれば false） */
  ok: boolean;
  /** 行ごとの診断結果 */
  rows: TRow[];
  /** 全体エラー（ヘッダー不正・CSV パース失敗・トランザクション失敗など） */
  fatalError: string | null;
};
