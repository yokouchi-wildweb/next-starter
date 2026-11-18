// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/BankTransferReviewCsvImportDialog.tsx
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

import { Upload, Download, AlertCircle, CheckCircle2, ArrowRight, MinusCircle } from "lucide-react";

import Modal from "@/components/Overlays/Modal";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Button } from "@/components/Form/Button";
import { Manual } from "@/components/Form/Input";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { Block } from "@/components/Layout/Block";
import { Label } from "@/components/Form/Label";
import { SolidBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import type { BankTransferReviewImportRowDto } from "@/features/core/bankTransferReview";
import { useAdminBankTransferReviewCsvImport } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewCsvImport";

import { formatJpyAmount } from "@/features/core/bankTransferReview/presenters";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 取込実行で確定した変更を親側に反映してもらうコールバック */
  onImportDone: () => void;
};

export function BankTransferReviewCsvImportDialog({ open, onOpenChange, onImportDone }: Props) {
  // 読み込み・プレビュー(dry-run)・実行・ひな形とエラー行の CSV は公開 hook。ここは描くだけ
  const {
    csvText,
    fileName,
    fileResetKey,
    preview,
    executed,
    isValidating,
    isSubmitting,
    selectFile,
    setText,
    removeFile,
    reset,
    validate,
    submit,
    downloadTemplate,
    downloadErrorRows,
  } = useAdminBankTransferReviewCsvImport({ onDone: onImportDone });

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const executableCount = preview
    ? preview.confirmedCount + preview.needsCheckCount
    : 0;
  const canSubmit =
    preview !== null && executableCount > 0 && !isSubmitting && !executed;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="振込明細CSVで一括判定"
      maxWidth={920}
      maxHeight="88vh"
    >
      <Stack className="gap-5 p-4">
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
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="size-4 mr-1" />
            ひな形をダウンロード
          </Button>
        </Flex>

        <Stack gap="xs">
          <Label className="text-sm font-medium">CSVファイル</Label>
          <Manual.FileInput
            accept=".csv,text/csv"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => void selectFile(e.target.files?.[0])}
            selectedFileName={fileName}
            onRemove={removeFile}
            resetKey={fileResetKey}
            className="cursor-pointer file:cursor-pointer"
          />
        </Stack>

        <Stack gap="xs">
          <Label className="text-sm font-medium">またはCSVテキストを直接貼り付け</Label>
          <Manual.Textarea
            rows={6}
            value={csvText}
            onChange={(e) => setText(e.target.value)}
            placeholder={"transfer_name,transfer_amount\n山田太郎12345678,1500"}
            className="font-mono text-xs"
          />
        </Stack>

        <Flex justify="end" gap="md">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void validate()}
            disabled={isValidating || !csvText.trim()}
          >
            <Upload className="size-4 mr-1" />
            {isValidating ? "検証中…" : "プレビュー"}
          </Button>
        </Flex>

        {preview ? (
          <Stack gap="sm">
            {preview.fatalError ? (
              <Flex
                align="start"
                gap="xs"
                className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text"
              >
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <Span inline>{preview.fatalError}</Span>
              </Flex>
            ) : null}

            {preview.rows.length > 0 ? (
              <>
                <Flex gap="md" align="center" wrap="wrap">
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
                        onClick={downloadErrorRows}
                      >
                        <Download className="size-4 mr-1" />
                        エラー行をCSVでDL
                      </Button>
                    </>
                  ) : null}
                </Flex>

                <Block className="overflow-x-auto rounded border">
                  <PreviewTable rows={preview.rows} />
                </Block>
              </>
            ) : null}
          </Stack>
        ) : null}

        <Flex justify="end" gap="md">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? "取り込み中…"
              : executed
                ? "取り込み完了"
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

const PREVIEW_COLUMNS: DataTableColumn<BankTransferReviewImportRowDto>[] = [
  { header: "行", width: "2.5rem", render: (row) => <Span inline tone="muted">{String(row.rowIndex)}</Span> },
  { header: "判定", width: "6rem", render: (row) => <DecisionBadge row={row} /> },
  { header: "振込人名", render: (row) => <Span inline className="break-all">{row.rawTransferName || "-"}</Span> },
  { header: "識別番号", width: "7rem", render: (row) => <Span inline className="font-mono">{row.parsedIdentifier ?? "-"}</Span> },
  {
    header: "CSV金額",
    width: "8rem",
    align: "right",
    render: (row) => (row.parsedAmount !== null ? formatJpyAmount(row.parsedAmount) : "-"),
  },
  {
    header: "期待金額",
    width: "8rem",
    align: "right",
    render: (row) => (row.expectedAmount !== null ? formatJpyAmount(row.expectedAmount) : "-"),
  },
  { header: "メッセージ", render: (row) => <Span inline tone="muted">{row.message ?? ""}</Span> },
];

/** 取り込みの下見の表(行ごとの判定)。エラーの行は色を付ける */
export function PreviewTable({ rows }: { rows: BankTransferReviewImportRowDto[] }) {
  return (
    <DataTable
      items={rows}
      columns={PREVIEW_COLUMNS}
      getKey={(row) => row.rowIndex}
      rowClassName={(row) => (row.status === "error" ? "bg-destructive/5" : "")}
      maxHeight="none"
      emptyValueFallback=""
    />
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
