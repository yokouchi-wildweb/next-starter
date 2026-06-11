// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewCsvImportDialog.tsx
//
// 銀行振込明細 CSV を一括取り込みするダイアログ。
//
// 仕様:
// - 必須列: 振込人名 / 振込金額（固定）
// - ひな形 DL: ヘッダーのみの空 CSV（伝票と異なり既存レコード一覧は付けない。
//   どの pending_review に当たるかは識別子マッチで自動判定するため）
// - 「プレビュー」で dryRun=true を叩き、行ごとの判定（confirm/needs_check/skip/error）と
//   集計バッジを表示
// - 「実行」で dryRun=false を叩き、トースト + ダイアログ閉じ + 親へリフレッシュ通知
// - エラー行があっても続行（ユーザー方針）。実行後の結果も同じ表で再描画
//
// 伝票 (TrackingNumberCsvImportDialog) を参考に、銀行振込仕様で書き起こしたもの。
// 共通枠を抽象化するのは今回まだしない（3 例目が出てから検討の方針）。

"use client";

import { useCallback, useState } from "react";
import { Upload, Download, AlertCircle, CheckCircle2, ArrowRight, MinusCircle } from "lucide-react";

import Modal from "@/components/Overlays/Modal";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button";
import { Manual } from "@/components/Form/Input";
import { Para } from "@/components/TextBlocks/Para";
import { SolidBadge } from "@/components/Badge";
import { useToast } from "@/lib/toast/useToast";
import { buildCsv, downloadCsv, downloadCsvTemplate, formatYmd } from "@/lib/csv";
import {
  adminBulkImportBankTransferReviewCsv,
  BANK_TRANSFER_REVIEW_IMPORT_HEADERS,
  type AdminBulkImportBankTransferReviewCsvResponse,
  type BankTransferReviewImportRowDto,
} from "@/features/core/bankTransferReview";

import { formatJpyAmount } from "./formatters";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 取込実行で確定した変更を親側に反映してもらうコールバック */
  onImportDone: () => void;
};

export function BankTransferReviewCsvImportDialog({ open, onOpenChange, onImportDone }: Props) {
  const { showToast } = useToast();

  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [fileResetKey, setFileResetKey] = useState(0);
  const [preview, setPreview] = useState<AdminBulkImportBankTransferReviewCsvResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = useCallback(() => {
    setCsvText("");
    setFileName(undefined);
    setFileResetKey((k) => k + 1);
    setPreview(null);
    setIsValidating(false);
    setIsSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState],
  );

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreview(null);
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFileName(undefined);
    setFileResetKey((k) => k + 1);
    setCsvText("");
    setPreview(null);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    downloadCsvTemplate({
      filename: `銀行振込レビュー取込ひな形_${formatYmd()}.csv`,
      headers: [...BANK_TRANSFER_REVIEW_IMPORT_HEADERS],
    });
  }, []);

  const handleDownloadErrorRows = useCallback(() => {
    if (!preview) return;
    const errorRows = preview.rows.filter((r) => r.status === "error");
    if (errorRows.length === 0) return;
    // 後追い調査用の固定列。再取込用ではなく管理者の確認ログ目的。
    const headers = [
      "row_index",
      "transfer_name",
      "transfer_amount",
      "parsed_identifier",
      "error_message",
    ];
    const rows = errorRows.map((r) => [
      String(r.rowIndex),
      r.rawTransferName,
      r.rawAmount,
      r.parsedIdentifier ?? "",
      r.message ?? "",
    ]);
    downloadCsv({
      filename: `銀行振込CSV取込エラー_${formatYmd()}.csv`,
      csvContent: buildCsv(headers, rows),
    });
  }, [preview]);

  const handleValidate = useCallback(async () => {
    if (!csvText.trim()) {
      showToast("CSVが空です", "error");
      return;
    }
    setIsValidating(true);
    try {
      const result = await adminBulkImportBankTransferReviewCsv({
        csvText,
        dryRun: true,
      });
      setPreview(result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "検証に失敗しました", "error");
    } finally {
      setIsValidating(false);
    }
  }, [csvText, showToast]);

  const handleSubmit = useCallback(async () => {
    if (!preview) return;
    setIsSubmitting(true);
    showToast({ message: "取り込み中…", variant: "loading", mode: "persistent" });
    try {
      const result = await adminBulkImportBankTransferReviewCsv({
        csvText,
        dryRun: false,
      });
      setPreview(result);
      if (result.fatalError) {
        showToast(result.fatalError, "error");
        return;
      }
      const summary = `承認 ${result.confirmedCount}件 / 要確認 ${result.needsCheckCount}件 / スキップ ${result.skipCount}件${result.errorCount > 0 ? ` / エラー ${result.errorCount}件` : ""}`;
      showToast(`取り込み完了: ${summary}`, "success");
      onImportDone();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "取り込みに失敗しました", "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [preview, csvText, showToast, onImportDone]);

  // 実行可能性: プレビュー済み + 実行候補が1件以上ある（confirm/needs_check が 0 件なら無意味）
  const executableCount = preview
    ? preview.confirmedCount + preview.needsCheckCount
    : 0;
  const canSubmit = preview !== null && executableCount > 0 && !isSubmitting;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="振込明細CSVで一括判定"
      maxWidth={920}
      maxHeight="88vh"
    >
      <Stack space={5} className="p-4">
        <Para size="sm" tone="muted">
          銀行明細の CSV を取り込み、振込人名末尾の 8 桁識別番号と振込金額から
          「レビュー待ち」のレビューを自動的に「承認」または「要確認」に振り分けます。
          <br />
          必須列は <code className="font-mono">transfer_name</code>（振込人名）/{" "}
          <code className="font-mono">transfer_amount</code>（振込金額）の 2 つ（固定列名）。
          <br />
          金額一致は自動承認、不一致は要確認に移動。識別番号が無い行は対象外として
          スキップ、識別番号があるのに該当レビューが無い行・複数マッチ行は
          エラーとして表示します（エラー行は CSV でダウンロードして後追い可能）。
        </Para>

        <Flex>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="size-4 mr-1" />
            ひな形をダウンロード
          </Button>
        </Flex>

        <Stack space={2}>
          <label className="text-sm font-medium">CSVファイル</label>
          <Manual.FileInput
            accept=".csv,text/csv"
            onChange={handleFileChange}
            selectedFileName={fileName}
            onRemove={handleRemoveFile}
            resetKey={fileResetKey}
            className="cursor-pointer file:cursor-pointer"
          />
        </Stack>

        <Stack space={2}>
          <label className="text-sm font-medium">またはCSVテキストを直接貼り付け</label>
          <Manual.Textarea
            rows={6}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setPreview(null);
              if (fileName) {
                setFileName(undefined);
                setFileResetKey((k) => k + 1);
              }
            }}
            placeholder={"transfer_name,transfer_amount\n山田太郎12345678,1500"}
            className="font-mono text-xs"
          />
        </Stack>

        <Flex justify="end" gap="sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating || !csvText.trim()}
          >
            <Upload className="size-4 mr-1" />
            {isValidating ? "検証中…" : "プレビュー"}
          </Button>
        </Flex>

        {preview ? (
          <Stack space={3}>
            {preview.fatalError ? (
              <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <span>{preview.fatalError}</span>
              </div>
            ) : null}

            {preview.rows.length > 0 ? (
              <>
                <Flex gap="sm" align="center" wrap="wrap">
                  <SolidBadge variant="success" size="sm">
                    <CheckCircle2 className="size-3 mr-1" />
                    承認 {preview.confirmedCount}件
                  </SolidBadge>
                  <SolidBadge variant="warning" size="sm">
                    <ArrowRight className="size-3 mr-1" />
                    要確認 {preview.needsCheckCount}件
                  </SolidBadge>
                  <SolidBadge variant="muted" size="sm">
                    <MinusCircle className="size-3 mr-1" />
                    スキップ {preview.skipCount}件
                  </SolidBadge>
                  {preview.errorCount > 0 ? (
                    <>
                      <SolidBadge variant="destructive" size="sm">
                        <AlertCircle className="size-3 mr-1" />
                        エラー {preview.errorCount}件
                      </SolidBadge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadErrorRows}
                      >
                        <Download className="size-4 mr-1" />
                        エラー行をCSVでDL
                      </Button>
                    </>
                  ) : null}
                </Flex>

                <div className="overflow-x-auto rounded border">
                  <PreviewTable rows={preview.rows} />
                </div>
              </>
            ) : null}
          </Stack>
        ) : null}

        <Flex justify="end" gap="sm">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? "取り込み中…"
              : executableCount > 0
                ? `${executableCount}件を取り込み`
                : "取り込み"}
          </Button>
        </Flex>
      </Stack>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// プレビュー表
// ----------------------------------------------------------------------------

function PreviewTable({ rows }: { rows: BankTransferReviewImportRowDto[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead className="bg-muted/50">
        <tr>
          <th className="w-10 px-2 py-1.5 text-left">行</th>
          <th className="w-24 px-2 py-1.5 text-left">判定</th>
          <th className="px-2 py-1.5 text-left">振込人名</th>
          <th className="w-28 px-2 py-1.5 text-left">識別番号</th>
          <th className="w-32 px-2 py-1.5 text-right">CSV金額</th>
          <th className="w-32 px-2 py-1.5 text-right">期待金額</th>
          <th className="px-2 py-1.5 text-left">メッセージ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.rowIndex}
            className={
              row.status === "error"
                ? "border-t border-destructive/20 bg-destructive/5"
                : "border-t"
            }
          >
            <td className="px-2 py-1.5 text-muted-foreground">{row.rowIndex}</td>
            <td className="px-2 py-1.5">
              <DecisionBadge row={row} />
            </td>
            <td className="px-2 py-1.5 break-all">{row.rawTransferName || "-"}</td>
            <td className="px-2 py-1.5 font-mono">{row.parsedIdentifier ?? "-"}</td>
            <td className="px-2 py-1.5 text-right">
              {row.parsedAmount !== null ? formatJpyAmount(row.parsedAmount) : "-"}
            </td>
            <td className="px-2 py-1.5 text-right">
              {row.expectedAmount !== null ? formatJpyAmount(row.expectedAmount) : "-"}
            </td>
            <td className="px-2 py-1.5 text-muted-foreground">{row.message ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DecisionBadge({ row }: { row: BankTransferReviewImportRowDto }) {
  if (row.status === "error") {
    return (
      <SolidBadge variant="destructive" size="sm">
        エラー
      </SolidBadge>
    );
  }
  switch (row.decision) {
    case "confirm":
      return (
        <SolidBadge variant="success" size="sm">
          承認
        </SolidBadge>
      );
    case "needs_check":
      return (
        <SolidBadge variant="warning" size="sm">
          要確認
        </SolidBadge>
      );
    case "skip":
    default:
      return (
        <SolidBadge variant="muted" size="sm">
          スキップ
        </SolidBadge>
      );
  }
}
