// src/features/core/bankTransferReview/hooks/useAdminBankTransferReviewCsvImport.ts
//
// 管理画面の振込明細 CSV の一括取り込み(CSV 取り込みのダイアログが呼ぶ)。
// - selectFile(file) で CSV を読み、setText(text) で直に貼り付け、removeFile / reset で空に戻す(プレビューと実行済みの印も解く)
// - validate = dryRun:true で行ごとの判定(confirm / needs_check / skip / error)を preview に入れる(executed を解く)。
//   空の CSV は送らず error の toast
// - submit = dryRun:false で実行。結果も preview に入れ直す。fatalError のときは何も処理されていないので
//   executed を立てず error の toast。成功で executed を立て(同じ CSV の誤った再実行を防ぐ)、
//   success の toast・一覧と件数の取り直し・onDone
// - downloadTemplate = ヘッダーだけのひな形、downloadErrorRows = エラー行の確認用 CSV(再取り込み用ではない)
// 失敗は投げず toast を出して false を返す。

"use client";

import { useCallback, useState } from "react";

import {
  adminBulkImportBankTransferReviewCsv,
  BANK_TRANSFER_REVIEW_IMPORT_HEADERS,
  type AdminBulkImportBankTransferReviewCsvResponse,
} from "@/features/core/bankTransferReview";
import { buildCsv, downloadCsv, downloadCsvTemplate, formatYmd } from "@/lib/csv";
import { useDomainMutation } from "@/lib/crud/hooks";
import { useToast } from "@/lib/toast";

import { ADMIN_BANK_TRANSFER_REVIEW_KEYS } from "./adminBankTransferReviewKeys";

export type UseAdminBankTransferReviewCsvImportOptions = {
  /** 実行で変更が確定したあとに呼ぶ(親の一覧の取り直しなど) */
  onDone?: () => void;
};

type ImportArg = { csvText: string; dryRun: boolean };

/** エラー行の確認用 CSV の列(後追いの調査用の固定列) */
const ERROR_ROW_HEADERS = ["row_index", "transfer_name", "transfer_amount", "parsed_identifier", "error_message"];

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function useAdminBankTransferReviewCsvImport({ onDone }: UseAdminBankTransferReviewCsvImportOptions = {}) {
  const { showToast } = useToast();

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  /** ファイルの入力欄を作り直すための key(取り消し・初期化で増える) */
  const [fileResetKey, setFileResetKey] = useState(0);
  const [preview, setPreview] = useState<AdminBulkImportBankTransferReviewCsvResponse | null>(null);
  // 実行済みの印。true の間は実行させない(再実行しても対象は処理済みで全行エラーになり、成功した結果表が
  // 上書きされて管理者を混乱させる)。CSV の差し替え・再プレビューで解く
  const [executed, setExecuted] = useState(false);

  const dryRun = useDomainMutation("bankTransferReviews/admin/csvDryRun", (arg: ImportArg) =>
    adminBulkImportBankTransferReviewCsv(arg),
  );
  const execute = useDomainMutation(
    "bankTransferReviews/admin/csvImport",
    (arg: ImportArg) => adminBulkImportBankTransferReviewCsv(arg),
    [ADMIN_BANK_TRANSFER_REVIEW_KEYS.list, ADMIN_BANK_TRANSFER_REVIEW_KEYS.statusCounts, ADMIN_BANK_TRANSFER_REVIEW_KEYS.detail],
  );

  const reset = useCallback(() => {
    setCsvText("");
    setFileName(undefined);
    setFileResetKey((k) => k + 1);
    setPreview(null);
    setExecuted(false);
  }, []);

  const selectFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreview(null);
    setExecuted(false);
  }, []);

  const removeFile = reset;

  /** CSV を直に貼り付けた(選んでいたファイルは外す) */
  const setText = useCallback(
    (text: string) => {
      setCsvText(text);
      setPreview(null);
      setExecuted(false);
      if (fileName !== undefined) {
        setFileName(undefined);
        setFileResetKey((k) => k + 1);
      }
    },
    [fileName],
  );

  const downloadTemplate = useCallback(() => {
    downloadCsvTemplate({
      filename: `銀行振込レビュー取込ひな形_${formatYmd()}.csv`,
      headers: [...BANK_TRANSFER_REVIEW_IMPORT_HEADERS],
    });
  }, []);

  const errorRows = preview?.rows.filter((r) => r.status === "error") ?? [];

  const downloadErrorRows = useCallback(() => {
    const rows = (preview?.rows ?? []).filter((r) => r.status === "error");
    if (rows.length === 0) return;
    downloadCsv({
      filename: `銀行振込CSV取込エラー_${formatYmd()}.csv`,
      csvContent: buildCsv(
        ERROR_ROW_HEADERS,
        rows.map((r) => [String(r.rowIndex), r.rawTransferName, r.rawAmount, r.parsedIdentifier ?? "", r.message ?? ""]),
      ),
    });
  }, [preview]);

  const dryRunTrigger = dryRun.trigger;
  const validate = useCallback(async (): Promise<boolean> => {
    if (!csvText.trim()) {
      showToast("CSVが空です", "error");
      return false;
    }
    try {
      const result = await dryRunTrigger({ csvText, dryRun: true });
      setPreview(result);
      // 新しいプレビューは新しい判定の根拠なので、実行済みの印を解く
      setExecuted(false);
      return true;
    } catch (error) {
      showToast(messageOf(error, "検証に失敗しました"), "error");
      return false;
    }
  }, [csvText, dryRunTrigger, showToast]);

  const executeTrigger = execute.trigger;
  const submit = useCallback(async (): Promise<boolean> => {
    if (!preview || executed) return false;
    showToast({ message: "取り込み中…", variant: "loading", mode: "persistent" });
    try {
      const result = await executeTrigger({ csvText, dryRun: false });
      setPreview(result);
      if (result.fatalError) {
        // 何も処理されていないので実行済みの印は立てず、再実行を許す
        showToast(result.fatalError, "error");
        return false;
      }
      setExecuted(true);
      const summary = `承認 ${result.confirmedCount}件 / 要確認 ${result.needsCheckCount}件 / スキップ ${result.skipCount}件${result.errorCount > 0 ? ` / エラー ${result.errorCount}件` : ""}`;
      showToast(`取り込み完了: ${summary}`, "success");
      onDone?.();
      return true;
    } catch (error) {
      showToast(messageOf(error, "取り込みに失敗しました"), "error");
      return false;
    }
  }, [preview, executed, csvText, executeTrigger, showToast, onDone]);

  return {
    csvText,
    fileName,
    fileResetKey,
    preview,
    errorRows,
    executed,
    isValidating: dryRun.isMutating,
    isSubmitting: execute.isMutating,
    selectFile,
    setText,
    removeFile,
    reset,
    validate,
    submit,
    downloadTemplate,
    downloadErrorRows,
  };
}
