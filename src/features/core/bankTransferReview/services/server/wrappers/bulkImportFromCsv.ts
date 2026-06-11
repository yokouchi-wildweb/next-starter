// src/features/core/bankTransferReview/services/server/wrappers/bulkImportFromCsv.ts
//
// 銀行振込明細 CSV を一括取り込みして、レビューを承認 (confirmed) または要確認
// (needs_check) に自動振り分けするサービス。
//
// 入力 CSV:
//   - 必須列: transfer_name / transfer_amount（固定列名・順不同。伝票CSVと同じ英語snake_caseで揃える）
//   - transfer_name の中に含まれる **8 桁ちょうど** の数字塊を識別子として
//     `purchase_requests.provider_order_id` と照合する（先頭・中間・末尾どこでも可）。
//     銀行明細によっては識別子が名前の前後どちらに付いているか不定なため任意位置を許容する。
//     ただし 9 桁以上の連続数字（取引ID 等）に巻き込まれない様に左右を非数字で境界付けする。
//   - 金額は「1,500」「¥1,500」等の表記揺れを許容（カンマ・通貨記号を除去して整数化）
//   - 銀行明細は全角数字 / 全角空白 / 全角通貨記号で出力される事が多いため、識別子抽出・金額
//     パースの直前に NFKC 正規化を掛けて半角化する（「１２３４５６７８」「￥１，５００」もマッチ可能）
//
// 判定ロジック（行ごと）:
//   - transfer_name / 金額が空、金額が数値化できない → status="error"（CSVが壊れている）
//   - 8 桁識別子が抽出できない                            → status="ok" + decision="skip"（自社振込でない可能性、想定内のノイズ）
//   - 識別子に該当する pending_review レビューが無い   → **status="error"**（識別番号があるのに DB に無いのは異常で見落としたくない）
//   - 該当が複数件                                          → **status="error"**（衝突は実質ゼロだが調査必要）
//   - 1 件マッチ + 金額一致                                → status="ok" + decision="confirm"
//   - 1 件マッチ + 金額不一致                              → status="ok" + decision="needs_check"
//
// エラー行は永続化されない（DBに該当レコードが無いため remap しようがない）。
// 管理者が後追いできるよう、UI 側でエラー行を CSV エクスポートできる導線を別途用意する。
//
// 実行モード:
//   - dryRun=true: 判定だけ行って何もコミットしない（プレビュー用）
//   - dryRun=false: confirm 行は confirmReview を、needs_check 行は escalateToNeedsCheck を
//     順次実行。各呼び出しは独立トランザクションのため、途中失敗は当該行のみ "error" に
//     差し替えて続行する（user の方針: エラー行があっても続行）
//
// レスポンス:
//   - 共通基底 CsvImportResponseBase + 集計件数 (confirmedCount / needsCheckCount / skipCount / errorCount)

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import {
  parseCsvWithHeaders,
  type CsvImportRowResultBase,
  type CsvImportResponseBase,
} from "@/lib/csv";
import { PurchaseRequestTable } from "@/features/core/purchaseRequest/entities/drizzle";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import { INHOUSE_BANK_TRANSFER_METHOD_ID } from "@/features/purchaseRequest/services/server/payment/inhouse";

import { BankTransferReviewTable } from "@/features/bankTransferReview/entities/drizzle";
import type { BankTransferReview } from "@/features/bankTransferReview/entities/model";

import { confirmReview } from "./confirmReview";
import { escalateToNeedsCheck } from "./escalateToNeedsCheck";

/** CSV 必須ヘッダー。ひな形 DL もこの 2 列のみ。伝票CSVと同様に snake_case 英語で固定 */
export const BANK_TRANSFER_REVIEW_IMPORT_HEADERS = [
  "transfer_name",
  "transfer_amount",
] as const;

/**
 * csvText の最大文字数（≒5MB）。誤って巨大ファイルを選んだ場合の即時拒否用。
 * 銀行明細 CSV は通常数百 KB 以下なので、正当な業務で当たることはない上限。
 */
export const BANK_TRANSFER_REVIEW_IMPORT_MAX_TEXT_LENGTH = 5_000_000;

/**
 * 取り込み対象のデータ行数上限。実行時は行ごとに逐次トランザクションを回すため、
 * 上限なしだと巨大 CSV で長時間リクエストになる。必要ならフォーク側で調整可。
 */
export const BANK_TRANSFER_REVIEW_IMPORT_MAX_ROWS = 10_000;

/** 行レベルの判定結果 */
export type BankTransferReviewImportDecision =
  | "confirm"
  | "needs_check"
  | "skip";

export type BankTransferReviewImportRow = CsvImportRowResultBase & {
  /** CSV から読んだ生値 */
  rawTransferName: string;
  rawAmount: string;
  /** 振込人名末尾から抽出した 8 桁。抽出できなければ null */
  parsedIdentifier: string | null;
  /** 表記揺れを正規化した整数金額（円）。パースできなければ null */
  parsedAmount: number | null;
  /** マッチしたレビュー ID。マッチ不能行は null */
  resolvedReviewId: string | null;
  /** 期待される金額 (purchase_requests.payment_amount)。マッチ不能行は null */
  expectedAmount: number | null;
  /** この行の決定。status=error の行は null */
  decision: BankTransferReviewImportDecision | null;
};

export type BulkImportBankTransferReviewCsvParams = {
  csvText: string;
  dryRun: boolean;
  /** 実行管理者 user_id（escalateToNeedsCheck / confirmReview 双方に伝搬） */
  triggeredBy: string;
};

export type BulkImportBankTransferReviewCsvResult =
  CsvImportResponseBase<BankTransferReviewImportRow> & {
    /** 自動承認した件数（dryRun=true なら 0） */
    confirmedCount: number;
    /** 要確認に移した件数（dryRun=true なら 0） */
    needsCheckCount: number;
    /** スキップ件数（マッチ不能・対象外） */
    skipCount: number;
    /** CSV エラー件数（パース失敗・必須列空欄等） */
    errorCount: number;
  };

/**
 * 8 桁ちょうどの数字塊を任意位置から抽出するための正規表現。
 *
 * - 末尾固定（`$`）は廃止し、先頭・中間・末尾のどこでも検出可能にする
 * - 左右に lookaround で「数字でないこと」を要求し、9 桁以上の連続数字（取引 ID 等）から
 *   8 桁を切り取って誤マッチするのを防ぐ
 * - 複数候補がある場合は最初の出現を採用（match の既定動作）。実運用では同一行内に
 *   8 桁ちょうどの数字塊が複数現れるのは稀のため許容
 */
const IDENTIFIER_REGEX = /(?<!\d)(\d{8})(?!\d)/;

/**
 * 全角→半角の互換正規化。
 * 銀行 CSV では数字・通貨記号・カンマ・空白などが全角で出力されるケースが多いため、
 * 識別子抽出・金額パースの双方の入口でこれを通して以降の処理を半角前提に統一する。
 * NFKC は ０-９→0-9 / ￥→¥ / ，→, / 全角スペース(U+3000)→半角スペース(U+0020) 等を吸収する。
 */
function toHalfWidth(s: string): string {
  return s.normalize("NFKC");
}

/** 「1,500」「¥1,500」「￥１，５００」等を 1500 に正規化。失敗時は null */
function parseAmount(raw: string): number | null {
  const cleaned = toHalfWidth(raw).replace(/[¥￥,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** 振込人名から 8 桁識別子を抽出（任意位置）。全角数字混入は NFKC で半角化してから判定 */
function extractIdentifier(rawName: string): string | null {
  const m = toHalfWidth(rawName).match(IDENTIFIER_REGEX);
  return m ? m[1] : null;
}

export async function bulkImportFromCsv(
  params: BulkImportBankTransferReviewCsvParams,
): Promise<BulkImportBankTransferReviewCsvResult> {
  const { csvText, dryRun, triggeredBy } = params;

  // 0. サイズ・行数の上限チェック（API ルートの Zod 検証と二段構え）
  if (csvText.length > BANK_TRANSFER_REVIEW_IMPORT_MAX_TEXT_LENGTH) {
    return emptyResult({
      ok: false,
      fatalError: `CSVが大きすぎます（最大 ${BANK_TRANSFER_REVIEW_IMPORT_MAX_TEXT_LENGTH.toLocaleString()} 文字）。ファイルを分割してください。`,
    });
  }

  // 1. CSVパース（共通ヘルパー）
  const parsed = parseCsvWithHeaders(csvText, BANK_TRANSFER_REVIEW_IMPORT_HEADERS);
  if (!parsed.ok) {
    return emptyResult({ ok: false, fatalError: parsed.error });
  }
  if (parsed.records.length === 0) {
    return emptyResult({
      ok: false,
      fatalError: "CSVにデータ行がありません。",
    });
  }
  if (parsed.records.length > BANK_TRANSFER_REVIEW_IMPORT_MAX_ROWS) {
    return emptyResult({
      ok: false,
      fatalError: `CSVの行数（${parsed.records.length.toLocaleString()} 行）が上限（${BANK_TRANSFER_REVIEW_IMPORT_MAX_ROWS.toLocaleString()} 行）を超えています。ファイルを分割してください。`,
    });
  }

  // 2. 行ごとの一次解析（識別子抽出 + 金額正規化）
  type Stage1 =
    | {
        kind: "ready";
        rowIndex: number;
        rawTransferName: string;
        rawAmount: string;
        identifier: string;
        amount: number;
      }
    | {
        kind: "row_error";
        rowIndex: number;
        rawTransferName: string;
        rawAmount: string;
        message: string;
      }
    | {
        kind: "no_identifier";
        rowIndex: number;
        rawTransferName: string;
        rawAmount: string;
        amount: number | null;
      };

  const stages: Stage1[] = parsed.records.map((row, i) => {
    const rowIndex = i + 1;
    const rawTransferName = (row["transfer_name"] ?? "").trim();
    const rawAmount = (row["transfer_amount"] ?? "").trim();

    if (!rawTransferName) {
      return {
        kind: "row_error",
        rowIndex,
        rawTransferName,
        rawAmount,
        message: "transfer_name が空です。",
      };
    }
    if (!rawAmount) {
      return {
        kind: "row_error",
        rowIndex,
        rawTransferName,
        rawAmount,
        message: "transfer_amount が空です。",
      };
    }

    const amount = parseAmount(rawAmount);
    if (amount === null) {
      return {
        kind: "row_error",
        rowIndex,
        rawTransferName,
        rawAmount,
        message: `transfer_amount「${rawAmount}」を数値として解釈できません。`,
      };
    }

    const identifier = extractIdentifier(rawTransferName);
    if (!identifier) {
      return {
        kind: "no_identifier",
        rowIndex,
        rawTransferName,
        rawAmount,
        amount,
      };
    }

    return {
      kind: "ready",
      rowIndex,
      rawTransferName,
      rawAmount,
      identifier,
      amount,
    };
  });

  // 3. 識別子を一括検索 (purchase_requests + bank_transfer_reviews を JOIN)
  //    payment_method=bank_transfer_inhouse の絞り込みで他プロバイダ起源の同 8 桁を除外。
  //    レビュー status は pending_review のみ対象（needs_check は人間判断中、confirmed/rejected は終端）。
  const identifiers = Array.from(
    new Set(
      stages
        .filter((s): s is Extract<Stage1, { kind: "ready" }> => s.kind === "ready")
        .map((s) => s.identifier),
    ),
  );

  type MatchEntry = {
    review: BankTransferReview;
    purchaseRequest: PurchaseRequest;
  };
  const matchesByIdentifier = new Map<string, MatchEntry[]>();

  if (identifiers.length > 0) {
    const rows = await db
      .select({
        review: BankTransferReviewTable,
        purchaseRequest: PurchaseRequestTable,
      })
      .from(BankTransferReviewTable)
      .innerJoin(
        PurchaseRequestTable,
        eq(BankTransferReviewTable.purchase_request_id, PurchaseRequestTable.id),
      )
      .where(
        and(
          eq(BankTransferReviewTable.status, "pending_review"),
          eq(PurchaseRequestTable.payment_method, INHOUSE_BANK_TRANSFER_METHOD_ID),
          inArray(PurchaseRequestTable.provider_order_id, identifiers),
        ),
      );

    for (const r of rows) {
      const key = (r.purchaseRequest as PurchaseRequest).provider_order_id;
      if (!key) continue;
      const list = matchesByIdentifier.get(key) ?? [];
      list.push({
        review: r.review as BankTransferReview,
        purchaseRequest: r.purchaseRequest as PurchaseRequest,
      });
      matchesByIdentifier.set(key, list);
    }
  }

  // 4. 行ごとに最終決定を確定
  const rowResults: BankTransferReviewImportRow[] = stages.map((s) => {
    if (s.kind === "row_error") {
      return {
        rowIndex: s.rowIndex,
        status: "error",
        message: s.message,
        rawTransferName: s.rawTransferName,
        rawAmount: s.rawAmount,
        parsedIdentifier: null,
        parsedAmount: null,
        resolvedReviewId: null,
        expectedAmount: null,
        decision: null,
      };
    }
    if (s.kind === "no_identifier") {
      return {
        rowIndex: s.rowIndex,
        status: "ok",
        message: "transfer_name に8桁の識別番号が含まれていません。対象外としてスキップします。",
        rawTransferName: s.rawTransferName,
        rawAmount: s.rawAmount,
        parsedIdentifier: null,
        parsedAmount: s.amount,
        resolvedReviewId: null,
        expectedAmount: null,
        decision: "skip",
      };
    }

    const matches = matchesByIdentifier.get(s.identifier) ?? [];
    if (matches.length === 0) {
      // 識別子はあるが DB に対応レビューが無い: 何もしないと管理者が見落とす可能性が高いため
      // status=error で赤表示。よくある原因は識別番号の入力ミス / 既に判定済み等。
      return {
        rowIndex: s.rowIndex,
        status: "error",
        message: `識別番号 ${s.identifier} に該当するレビュー待ちのレビューがありません。`,
        rawTransferName: s.rawTransferName,
        rawAmount: s.rawAmount,
        parsedIdentifier: s.identifier,
        parsedAmount: s.amount,
        resolvedReviewId: null,
        expectedAmount: null,
        decision: null,
      };
    }
    if (matches.length > 1) {
      return {
        rowIndex: s.rowIndex,
        status: "error",
        message: `識別番号 ${s.identifier} が複数のレビューと一致しました。手動確認が必要です。`,
        rawTransferName: s.rawTransferName,
        rawAmount: s.rawAmount,
        parsedIdentifier: s.identifier,
        parsedAmount: s.amount,
        resolvedReviewId: null,
        expectedAmount: null,
        decision: null,
      };
    }

    const m = matches[0];
    const expected = m.purchaseRequest.payment_amount;
    if (s.amount === expected) {
      return {
        rowIndex: s.rowIndex,
        status: "ok",
        message: null,
        rawTransferName: s.rawTransferName,
        rawAmount: s.rawAmount,
        parsedIdentifier: s.identifier,
        parsedAmount: s.amount,
        resolvedReviewId: m.review.id,
        expectedAmount: expected,
        decision: "confirm",
      };
    }
    return {
      rowIndex: s.rowIndex,
      status: "ok",
      message: `金額不一致 (CSV: ¥${s.amount.toLocaleString("ja-JP")} / 期待: ¥${expected.toLocaleString("ja-JP")})。要確認に移動します。`,
      rawTransferName: s.rawTransferName,
      rawAmount: s.rawAmount,
      parsedIdentifier: s.identifier,
      parsedAmount: s.amount,
      resolvedReviewId: m.review.id,
      expectedAmount: expected,
      decision: "needs_check",
    };
  });

  // 5. dryRun は集計だけ返却
  if (dryRun) {
    return summarize(rowResults, { ok: !rowResults.some((r) => r.status === "error") });
  }

  // 6. 実行: confirm / needs_check 行を順次処理
  //    各呼び出しは独立 tx。途中失敗はその行のみ error に差し替え、他行は続行する。
  for (const r of rowResults) {
    if (r.status !== "ok" || !r.resolvedReviewId) continue;
    if (r.decision !== "confirm" && r.decision !== "needs_check") continue;

    try {
      if (r.decision === "confirm") {
        await confirmReview({
          reviewId: r.resolvedReviewId,
          reviewedBy: triggeredBy,
          // CSV 取込経由の自動承認であることをレコードに刻む。
          // 後で管理画面・監査ログで「手動 / 自動」を判別する唯一の手掛かり。
          source: "csv_auto",
        });
      } else {
        if (r.parsedAmount === null || r.expectedAmount === null) {
          // 型上のガード（ここに来ることは無い想定だが保険）
          r.status = "error";
          r.message = "金額情報が不足しているため要確認に移動できません。";
          r.decision = null;
          continue;
        }
        await escalateToNeedsCheck({
          reviewId: r.resolvedReviewId,
          reason: "amount_mismatch",
          context: {
            reason: "amount_mismatch",
            csvAmount: r.parsedAmount,
            expectedAmount: r.expectedAmount,
          },
          triggeredBy,
        });
      }
    } catch (e) {
      // 競合 (他管理者が同時に承認) や DB エラー等。当該行のみ error 化して続行。
      r.status = "error";
      r.decision = null;
      r.message = e instanceof Error ? e.message : String(e);
    }
  }

  return summarize(rowResults, { ok: !rowResults.some((r) => r.status === "error") });
}

/** rowResults から集計を組んで結果を返す */
function summarize(
  rowResults: BankTransferReviewImportRow[],
  baseFlags: { ok: boolean },
): BulkImportBankTransferReviewCsvResult {
  let confirmedCount = 0;
  let needsCheckCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  for (const r of rowResults) {
    if (r.status === "error") {
      errorCount++;
    } else if (r.decision === "confirm") {
      confirmedCount++;
    } else if (r.decision === "needs_check") {
      needsCheckCount++;
    } else if (r.decision === "skip") {
      skipCount++;
    }
  }
  return {
    ok: baseFlags.ok,
    rows: rowResults,
    fatalError: null,
    confirmedCount,
    needsCheckCount,
    skipCount,
    errorCount,
  };
}

/** ヘッダー欠落・空 CSV のときの空応答 */
function emptyResult(opts: {
  ok: boolean;
  fatalError: string | null;
}): BulkImportBankTransferReviewCsvResult {
  return {
    ok: opts.ok,
    rows: [],
    fatalError: opts.fatalError,
    confirmedCount: 0,
    needsCheckCount: 0,
    skipCount: 0,
    errorCount: 0,
  };
}
