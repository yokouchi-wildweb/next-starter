// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewTable.tsx
//
// 銀行振込レビュー一覧テーブル。
// 行クリックで複数行を選択でき、選択時はバルクアクション「メール一斉送信」を
// 表示する。承認/拒否などの判定は最右の操作列「承認作業」ボタンから
// 詳細モーダルを開いて行う。
// レビュー側の status はタブで切り替えるため列としては表示しない。

"use client";

import { useMemo, type Key } from "react";
import { Pencil } from "lucide-react";

import { RecordSelectionTable, type DataTableColumn } from "@/lib/tableSuite";
import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Form/Button";
import { PromptPopover } from "@/components/Overlays/Popover";
import { BulkSendEmailButton } from "@/components/BulkSendEmail";
import {
  adminBulkSendBankTransferReviewEmail,
  type AdminBankTransferReviewListItem,
  type BankTransferReviewMode,
  type BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";

import {
  approvalSourceBadgeVariant,
  formatApprovalSourceLabel,
  formatBankTransferDate,
  formatJpyAmount,
  formatModeLabel,
  formatNeedsCheckContextSummary,
  formatNeedsCheckReasonLabel,
  formatPurchaseRequestStatusLabel,
  modeBadgeVariant,
  purchaseRequestStatusBadgeVariant,
} from "./formatters";

type Props = {
  /** 現在表示中のタブ。要確認タブのときは「理由」列を出す */
  status: BankTransferReviewStatus;
  items: AdminBankTransferReviewListItem[];
  onSelect: (reviewId: string) => void;
  /** チェックボックスで選択中の行キー（review.id） */
  selectedKeys: Key[];
  /** 選択変更時のコールバック */
  onSelectionChange: (keys: Key[]) => void;
  /** バルクアクション完了後に一覧を再取得するコールバック */
  onBulkActionDone: () => void;
  /** 管理者メモのインライン編集確定時のコールバック */
  onAdminMemoChange: (reviewId: string, memo: string) => void;
  /**
   * 氏名プロファイルがプロジェクト構成に存在するか（一覧 API の同名フィールド）。
   * false のとき氏名カラムを表示しない。未指定（移行期の旧 API レスポンス）は表示する。
   */
  profileNameAvailable?: boolean;
};

export function BankTransferReviewTable({
  status,
  items,
  onSelect,
  selectedKeys,
  onSelectionChange,
  onBulkActionDone,
  onAdminMemoChange,
  profileNameAvailable,
}: Props) {
  const showNeedsCheckColumn = status === "needs_check";
  // 承認済み / 拒否タブでは判定日時 (reviewed_at) を申告日時の左隣に表示する。
  // ヘッダー文言はタブごとに「承認日時」「拒否日時」と出し分ける。
  const showReviewedAtColumn = status === "confirmed" || status === "rejected";
  const reviewedAtHeader = status === "confirmed" ? "承認日時" : "拒否日時";
  // 承認方法（手動 / CSV自動）は confirmed タブでのみ意味があるためここで出す。
  // rejected には approval_source が立たないので列追加しない。
  const showApprovalSourceColumn = status === "confirmed";
  // 氏名プロファイルが無いプロジェクトでは全行「未登録」になるため列ごと出さない。
  const showNameColumn = profileNameAvailable ?? true;

  const columns = useMemo<DataTableColumn<AdminBankTransferReviewListItem>[]>(
    () => [
      ...(showReviewedAtColumn
        ? [
            {
              header: reviewedAtHeader,
              render: (item: AdminBankTransferReviewListItem) =>
                formatBankTransferDate(item.review.reviewed_at),
              width: "160px",
            } satisfies DataTableColumn<AdminBankTransferReviewListItem>,
          ]
        : []),
      {
        header: "申告日時",
        render: (item) => formatBankTransferDate(item.review.submitted_at),
        width: "160px",
      },
      {
        header: "ステータス",
        render: (item) => {
          const prStatus = item.purchaseRequest?.status;
          return prStatus ? (
            <SoftBadge
              variant={purchaseRequestStatusBadgeVariant(prStatus)}
              size="sm"
            >
              {formatPurchaseRequestStatusLabel(prStatus)}
            </SoftBadge>
          ) : (
            "-"
          );
        },
        width: "140px",
      },
      {
        header: "モード",
        render: (item) => (
          <SoftBadge
            variant={modeBadgeVariant(item.review.mode as BankTransferReviewMode)}
            size="sm"
          >
            {formatModeLabel(item.review.mode as BankTransferReviewMode)}
          </SoftBadge>
        ),
        width: "140px",
      },
      ...(showApprovalSourceColumn
        ? [
            {
              header: "承認方法",
              render: (item: AdminBankTransferReviewListItem) => (
                <SoftBadge
                  variant={approvalSourceBadgeVariant(item.review.approval_source)}
                  size="sm"
                >
                  {formatApprovalSourceLabel(item.review.approval_source)}
                </SoftBadge>
              ),
              width: "140px",
            } satisfies DataTableColumn<AdminBankTransferReviewListItem>,
          ]
        : []),
      ...(showNeedsCheckColumn
        ? [
            {
              header: "要確認の理由",
              render: (item: AdminBankTransferReviewListItem) => {
                const reason = item.review.needs_check_reason;
                if (!reason) return "-";
                const summary = formatNeedsCheckContextSummary(
                  item.review.needs_check_context,
                );
                return (
                  <div className="flex flex-col gap-0.5">
                    <SoftBadge variant="warning" size="sm">
                      {formatNeedsCheckReasonLabel(reason)}
                    </SoftBadge>
                    {summary ? (
                      <span className="text-xs text-muted-foreground">{summary}</span>
                    ) : null}
                  </div>
                );
              },
              width: "240px",
            } satisfies DataTableColumn<AdminBankTransferReviewListItem>,
          ]
        : []),
      {
        header: "ユーザー名",
        render: (item) => item.user?.name ?? "(名前未設定)",
      },
      ...(showNameColumn
        ? [
            {
              header: "氏名",
              render: (item: AdminBankTransferReviewListItem) => {
                const fullName = [
                  item.userProfile?.lastName,
                  item.userProfile?.firstName,
                ]
                  .map((part) => part?.trim())
                  .filter((part): part is string => Boolean(part))
                  .join(" ");
                return fullName || "未登録";
              },
            } satisfies DataTableColumn<AdminBankTransferReviewListItem>,
          ]
        : []),
      {
        header: "メールアドレス",
        render: (item) => item.user?.email ?? "(メール未設定)",
      },
      {
        header: "振込金額",
        render: (item) =>
          item.purchaseRequest
            ? formatJpyAmount(item.purchaseRequest.payment_amount)
            : "-",
        align: "right",
        width: "120px",
      },
      {
        header: "識別子",
        render: (item) => item.purchaseRequest?.provider_order_id ?? "-",
        width: "120px",
      },
      {
        header: "管理者メモ",
        // 発送リクエスト一覧と同じ表示方式: 全文を1行 truncate 表示し、
        // セルクリックで編集ポップオーバーを開く。メール一斉送信での
        // 送付履歴の追記もこの列・ポップオーバーで確認できる。
        render: (item) =>
          item.review.admin_memo ? (
            <span className="text-sm truncate max-w-[200px] block">
              {item.review.admin_memo}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">メモを追加</span>
          ),
        cellAction: {
          popover: (item, trigger) => (
            <PromptPopover
              trigger={trigger}
              title="管理者メモを編集"
              placeholder="メモを入力..."
              defaultValue={item.review.admin_memo ?? ""}
              multiline
              rows={4}
              onConfirm={(memo) => {
                onAdminMemoChange(item.review.id, memo);
              }}
            />
          ),
          indicator: <Pencil className="size-3" />,
          fullWidth: true,
        },
        width: "200px",
      },
      {
        // 最右の操作列。行クリックは選択に使うため、詳細モーダルの起動は
        // このボタンに集約する。クリックは行選択へ伝播させない。
        header: "操作",
        render: (item) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.review.id);
            }}
          >
            承認作業
          </Button>
        ),
        align: "center",
        width: "120px",
      },
    ],
    [
      showNeedsCheckColumn,
      showReviewedAtColumn,
      showApprovalSourceColumn,
      showNameColumn,
      reviewedAtHeader,
      onSelect,
      onAdminMemoChange,
    ],
  );

  return (
    <RecordSelectionTable
      items={items}
      columns={columns}
      getKey={(item) => item.review.id}
      className="rounded-lg border border-border bg-card"
      emptyValueFallback="-"
      selectionBehavior="row"
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => onSelectionChange(keys)}
      bulkActionsAlwaysVisible
      bulkActionsEmptyMessage="レビューを選択するとメールを一斉送信できます"
      bulkActions={(selection) => (
        <BulkSendEmailButton
          ids={selection.selectedIds}
          onSend={adminBulkSendBankTransferReviewEmail}
          recordNoun="振込レビュー"
          defaultNotificationTitle="お振込に関するお知らせ"
          defaultNotificationBody={`お振込のご確認に関する重要なお知らせをメールにて送付しております。
お手数をおかけいたしますが、ご確認のほどお願いいたします。`}
          subjectPlaceholder="例: お振込内容の確認のお願い"
          onSuccess={() => {
            selection.clear();
            onBulkActionDone();
          }}
        />
      )}
    />
  );
}
