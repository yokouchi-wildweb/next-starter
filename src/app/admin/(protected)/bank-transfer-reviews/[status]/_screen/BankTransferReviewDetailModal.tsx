// src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/BankTransferReviewDetailModal.tsx
//
// 銀行振込レビューの詳細モーダル。
// 詳細情報の表示と、status=pending_review 時の承認/拒否アクションをまとめて担う。

"use client";

import { useState, type ChangeEvent } from "react";

import Modal from "@/components/Overlays/Modal";
import Dialog from "@/components/Overlays/Dialog";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Button } from "@/components/Form/Button";
import { Manual } from "@/components/Form/Input";
import { SoftBadge } from "@/components/Badge/SoftBadge";
import { ZoomableImage } from "@/components/Overlays/ImageViewer";
import { resolveStorageSrc } from "@/lib/storage";
import { useGate } from "@/featureGate/client";
import { err } from "@/lib/errors";
import {
  ADMIN_MEMO_MAX,
  INVESTIGATE_NOTE_MAX,
  REJECT_REASON_MAX,
  type BankTransferReviewApprovalSource,
  type BankTransferReviewDto,
  type BankTransferReviewMode,
  type BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";
import {
  CurrencyDisplay,
  walletConfig,
  type WalletType,
} from "@/features/core/wallet";
import { useAdminBankTransferReview } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReview";
import { useAdminBankTransferReviewDecision } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewDecision";
import { useAdminBankTransferReviewMemo } from "@/features/core/bankTransferReview/hooks/useAdminBankTransferReviewMemo";

import {
  approvalSourceBadgeVariant,
  formatApprovalSourceLabel,
  formatBankTransferDate,
  formatJpyAmount,
  formatModeLabel,
  formatNeedsCheckContextSummary,
  formatNeedsCheckReasonLabel,
  formatPurchaseRequestStatusLabel,
  formatStatusLabel,
  modeBadgeVariant,
  purchaseRequestStatusBadgeVariant,
  statusBadgeVariant,
} from "@/features/core/bankTransferReview/presenters";


type Props = {
  reviewId: string | null;
  onClose: () => void;
  /** 承認/拒否が成功したら呼ばれる。親側で一覧を mutate してもらう。 */
  onActionDone: () => void;
};

export function BankTransferReviewDetailModal({ reviewId, onClose, onActionDone }: Props) {
  const open = reviewId !== null;

  // reviewId が変わるたびに 1 回だけ取得 (再取得は refresh)
  const { data, review, isLoading, error, refresh } = useAdminBankTransferReview(reviewId);

  const status = review?.status as BankTransferReviewStatus | undefined;
  const mode = review?.mode as BankTransferReviewMode | undefined;
  // pending_review / needs_check / investigating はすべて管理者の判定対象。承認/拒否ボタンを出す。
  const isActionable =
    status === "pending_review" ||
    status === "needs_check" ||
    status === "investigating";
  // 検証中への移行は pending_review / needs_check からのみ（investigating からは出さない）。
  const canEscalateToInvestigating =
    status === "pending_review" || status === "needs_check";

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="銀行振込レビュー詳細"
      maxWidth={760}
      maxHeight="85vh"
    >
      {error ? (
        <Flex align="center" justify="center" className="min-h-[160px]">
          <Para tone="destructive">{err(error, "詳細の取得に失敗しました")}</Para>
        </Flex>
      ) : isLoading || !data ? (
        <Flex align="center" justify="center" className="min-h-[160px]">
          <Para tone="muted">読込中...</Para>
        </Flex>
      ) : (
        <Stack space={5}>
          <ProofImageSection proofImageUrl={review?.proof_image_url} />

          <PurchaseRequestSection
            purchaseRequest={data.purchaseRequest}
            review={review}
            user={data.user}
          />

          {review?.needs_check_reason ? (
            <NeedsCheckReasonSection review={review} />
          ) : null}

          {!isActionable ? (
            <ReviewedSection
              reviewer={data.reviewer}
              reviewedAt={review?.reviewed_at ?? null}
              rejectReason={review?.reject_reason ?? null}
              status={status}
              approvalSource={review?.approval_source ?? null}
            />
          ) : null}

          {reviewId ? (
            <AdminMemoSection
              reviewId={reviewId}
              initialMemo={review?.admin_memo ?? null}
              onSaved={onActionDone}
            />
          ) : null}

          {isActionable && reviewId && mode ? (
            <ActionSection
              reviewId={reviewId}
              mode={mode}
              canEscalateToInvestigating={canEscalateToInvestigating}
              onSuccess={() => {
                onActionDone();
                void refresh();
              }}
            />
          ) : null}
        </Stack>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// セクション: 関連 purchase_request
// ----------------------------------------------------------------------------

/**
 * detail API の purchaseRequest は Record<string, unknown>。
 * 表示に使う最小フィールドのみ局所的に narrow する。
 */
type PurchaseRequestSummary = {
  id?: string;
  payment_amount?: number;
  amount?: number;
  wallet_type?: string | null;
  status?: string;
  provider_order_id?: string | null;
  completed_at?: string | null;
};

function PurchaseRequestSection({
  purchaseRequest,
  review,
  user,
}: {
  purchaseRequest: Record<string, unknown> | null;
  review: BankTransferReviewDto | undefined;
  user: { id: string; name: string | null; email: string | null } | null;
}) {
  if (!purchaseRequest) {
    return (
      <Para tone="muted" size="sm">
        関連する購入リクエストが見つかりません。
      </Para>
    );
  }

  const pr = purchaseRequest as PurchaseRequestSummary;

  return (
    <DefinitionList>
      <DefinitionRow label="購入リクエストID">
        <code className="text-xs">{pr.id ?? "-"}</code>
      </DefinitionRow>
      <DefinitionRow label="ユーザー名">{user?.name ?? "(未設定)"}</DefinitionRow>
      <DefinitionRow label="メール">{user?.email ?? "(未設定)"}</DefinitionRow>
      <DefinitionRow label="ステータス">
        <Flex gap="sm" align="center" wrap="wrap">
          {pr.status ? (
            <SoftBadge
              variant={purchaseRequestStatusBadgeVariant(pr.status)}
              size="sm"
            >
              {formatPurchaseRequestStatusLabel(pr.status)}
            </SoftBadge>
          ) : null}
          {review ? (
            <>
              <SoftBadge variant={modeBadgeVariant(review.mode)} size="sm">
                {formatModeLabel(review.mode)}
              </SoftBadge>
              <SoftBadge variant={statusBadgeVariant(review.status)} size="sm">
                {formatStatusLabel(review.status)}
              </SoftBadge>
            </>
          ) : null}
        </Flex>
      </DefinitionRow>
      <DefinitionRow label="金額">
        <AmountInline
          amount={pr.amount}
          paymentAmount={pr.payment_amount}
          walletType={pr.wallet_type}
        />
      </DefinitionRow>
      <DefinitionRow label="振込識別子">
        {pr.provider_order_id ?? "-"}
      </DefinitionRow>
      <DefinitionRow label="申請/完了日時">
        <Flex gap="sm" align="center" wrap="wrap">
          <span>{formatBankTransferDate(review?.submitted_at ?? null)}</span>
          <span className="text-muted-foreground">/</span>
          <span>{formatBankTransferDate(pr.completed_at ?? null)}</span>
        </Flex>
      </DefinitionRow>
    </DefinitionList>
  );
}

/**
 * 付与額(通貨) と 振込金額(円) を「コイン / ¥金額」形式で横並び表示する。
 * wallet_type が未知の値や null の場合は CurrencyDisplay を出さず、フォールバックする。
 * ウォレットの機能が閉じているときは通貨の表示(wallet の部品・設定)を使わず、付与額を数字だけで出す。
 */
function AmountInline({
  amount,
  paymentAmount,
  walletType,
}: {
  amount: number | undefined;
  paymentAmount: number | undefined;
  walletType: string | null | undefined;
}) {
  // wallet の部品・設定を読むこのファイルの中で門番を確かめる(依存の検査 src/featureGate/checks/dependencies.mjs は
  // import するファイルの字面の useGate().enabled("wallet") を見る。fork の Screen は useAdminBankTransferReview の walletEnabled でもよい)
  const walletOpen = useGate().enabled("wallet");
  const isKnownWalletType = walletOpen && walletType != null && walletType in walletConfig.currency;
  const hasAmount = typeof amount === "number";
  const hasPaymentAmount = typeof paymentAmount === "number";

  return (
    <Flex gap="sm" align="center" wrap="wrap">
      {hasAmount && !walletOpen ? (
        <span>{amount.toLocaleString()}</span>
      ) : hasAmount && isKnownWalletType ? (
        <CurrencyDisplay
          walletType={walletType as WalletType}
          amount={amount}
          showLabel
          size="sm"
        />
      ) : (
        <span>-</span>
      )}
      <span className="text-muted-foreground">/</span>
      {hasPaymentAmount ? (
        <span>{formatJpyAmount(paymentAmount)}</span>
      ) : (
        <span>-</span>
      )}
    </Flex>
  );
}

// ----------------------------------------------------------------------------
// セクション: 振込明細画像
// ----------------------------------------------------------------------------

function ProofImageSection({ proofImageUrl }: { proofImageUrl: string | undefined }) {
  if (!proofImageUrl) {
    return (
      <Para tone="muted" size="sm">
        画像が登録されていません。
      </Para>
    );
  }
  return (
    <Stack space={1}>
      {/* proofImageUrl は storage ref（非公開）。固定 URL に解決し、302 → 短期署名で表示する */}
      <ZoomableImage
        src={resolveStorageSrc(proofImageUrl) ?? ""}
        alt="振込明細画像"
        className="block h-auto w-auto max-h-[260px] max-w-full rounded-md border border-border object-contain"
      />
      <Para size="xs" tone="muted" align="center">
        画像をクリックすると拡大表示します。
      </Para>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// セクション: レビュー実施情報 (判定済みのみ)
// ----------------------------------------------------------------------------

function ReviewedSection({
  reviewer,
  reviewedAt,
  rejectReason,
  status,
  approvalSource,
}: {
  reviewer: { id: string; name: string | null; email: string | null } | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  status: BankTransferReviewStatus | undefined;
  /**
   * 承認の入力経路（confirmed のときのみ意味を持つ）。
   * rejected 時は null 想定だが、誤って渡されても表示行は status で分岐するため安全。
   */
  approvalSource: BankTransferReviewApprovalSource | null;
}) {
  return (
    <Stack space={2}>
      <SecTitle>レビュー実施情報</SecTitle>
      <DefinitionList>
        <DefinitionRow label="実施日時">
          {formatBankTransferDate(reviewedAt)}
        </DefinitionRow>
        <DefinitionRow label="実施者">
          {reviewer
            ? `${reviewer.name ?? "(名前未設定)"} (${reviewer.email ?? "(メール未設定)"})`
            : "-"}
        </DefinitionRow>
        {status === "confirmed" ? (
          <DefinitionRow label="承認方法">
            <SoftBadge
              variant={approvalSourceBadgeVariant(approvalSource)}
              size="sm"
            >
              {formatApprovalSourceLabel(approvalSource)}
            </SoftBadge>
          </DefinitionRow>
        ) : null}
        {status === "rejected" ? (
          <DefinitionRow label="拒否理由">
            {rejectReason ? (
              <span className="whitespace-pre-wrap break-words">{rejectReason}</span>
            ) : (
              "(理由は記録されていません)"
            )}
          </DefinitionRow>
        ) : null}
      </DefinitionList>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// セクション: 承認/拒否アクション (pending_review のみ)
// ----------------------------------------------------------------------------

function ActionSection({
  reviewId,
  mode,
  canEscalateToInvestigating,
  onSuccess,
}: {
  reviewId: string;
  mode: BankTransferReviewMode;
  /**
   * 「検証中に移行」ボタンを表示するかどうか。
   * pending_review / needs_check の時のみ true。investigating からは出さない。
   */
  canEscalateToInvestigating: boolean;
  onSuccess: () => void;
}) {
  // 確認の開閉・入力・検査・送信・toast・reviewId での初期化は公開 hook。ここは文言と描画だけ
  const {
    openDialog,
    open: openDecision,
    close: closeDecision,
    confirm,
    reject,
    investigate,
    rejectReason,
    setRejectReason,
    rejectError,
    investigateNote,
    setInvestigateNote,
    investigateError,
    confirming,
    rejecting,
    investigating,
    busy: actionsBusy,
  } = useAdminBankTransferReviewDecision({ reviewId, onDone: onSuccess });

  // mode による承認時の確認文言
  const confirmDescription =
    mode === "immediate"
      ? "即時付与モードのため、通貨残高は変動しません。振込確認の記録のみ実施します。"
      : "手動付与モードのため、承認するとユーザーに通貨が付与されます。本当に承認しますか？";

  // mode による拒否時の警告
  const rejectWarning =
    mode === "immediate"
      ? "即時付与モードのため、拒否しても既に付与済みの通貨はロールバックされません。残高調整やユーザー連絡は別途手動で対応してください。"
      : "手動付与モードのため、拒否すると関連する購入リクエストが failed になり、通貨は付与されません。";

  return (
    <>
      <Flex gap="sm" justify="end" wrap="wrap">
        {canEscalateToInvestigating ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => openDecision("investigate")}
            disabled={actionsBusy}
          >
            検証中に移行
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          onClick={() => openDecision("reject")}
          disabled={actionsBusy}
        >
          拒否
        </Button>
        <Button
          type="button"
          variant="success"
          onClick={() => openDecision("confirm")}
          disabled={actionsBusy}
        >
          承認
        </Button>
      </Flex>

      {/* 承認確認モーダル */}
      <Dialog
        open={openDialog === "confirm"}
        onOpenChange={(o) => {
          if (!o) closeDecision();
        }}
        title="レビューを承認しますか？"
        description={confirmDescription}
        confirmLabel={confirming ? "承認中..." : "承認する"}
        cancelLabel="キャンセル"
        confirmVariant="success"
        confirmDisabled={confirming}
        onConfirm={() => void confirm()}
      />

      {/* 拒否確認モーダル (理由入力フォーム付き) */}
      <Modal
        open={openDialog === "reject"}
        onOpenChange={(o) => {
          if (!o) closeDecision();
        }}
        title="レビューを拒否しますか？"
        maxWidth={560}
      >
        <Stack space={4}>
          <Para size="sm" tone="warning">
            {rejectWarning}
          </Para>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              拒否理由 (必須・{REJECT_REASON_MAX} 文字以内)
            </span>
            <Manual.Textarea
              value={rejectReason}
              rows={4}
              placeholder="例: 振込明細画像と銀行口座入金履歴の照合ができないため"
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
              aria-invalid={Boolean(rejectError)}
            />
            <span className="text-xs text-muted-foreground">
              {rejectReason.length} / {REJECT_REASON_MAX}
            </span>
            {rejectError ? (
              <span className="text-xs text-destructive-text">{rejectError}</span>
            ) : null}
          </label>
          <Flex gap="sm" justify="end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDecision}
              disabled={rejecting}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void reject()}
              disabled={rejecting}
            >
              {rejecting ? "拒否中..." : "拒否を確定"}
            </Button>
          </Flex>
        </Stack>
      </Modal>

      {/* 検証中移行モーダル (メモは任意入力) */}
      <Modal
        open={openDialog === "investigate"}
        onOpenChange={(o) => {
          if (!o) closeDecision();
        }}
        title="検証中に移行しますか？"
        maxWidth={560}
      >
        <Stack space={4}>
          <Para size="sm" tone="warning">
            通貨残高や購入リクエストの状態は変更されません。レビューを
            「検証中」に切り替え、ユーザーへの停止措置など追加対応が必要な
            ケースとして識別します。停止措置の実施自体は別画面・別オペレーションで
            運用してください。
          </Para>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              メモ (任意・{INVESTIGATE_NOTE_MAX} 文字以内)
            </span>
            <Manual.Textarea
              value={investigateNote}
              rows={4}
              placeholder="例: 同一画像での複数申告の疑いあり。ユーザーへ確認連絡中"
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInvestigateNote(e.target.value)}
              aria-invalid={Boolean(investigateError)}
            />
            <span className="text-xs text-muted-foreground">
              {investigateNote.length} / {INVESTIGATE_NOTE_MAX}
            </span>
            {investigateError ? (
              <span className="text-xs text-destructive-text">{investigateError}</span>
            ) : null}
          </label>
          <Flex gap="sm" justify="end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDecision}
              disabled={investigating}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void investigate()}
              disabled={investigating}
            >
              {investigating ? "移行中..." : "検証中に移行"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------------------
// セクション: 要確認理由 (status=needs_check の根拠表示)
// ----------------------------------------------------------------------------

/**
 * needs_check_reason / needs_check_context が立っているレビューに対し、
 * 「なぜこの状態になったか」を一目で分かる形で表示する。
 * 承認/拒否後もデータは残し続ける運用 (履歴) なので、確定後のレビューでも表示する。
 */
function NeedsCheckReasonSection({ review }: { review: BankTransferReviewDto }) {
  const reasonLabel = formatNeedsCheckReasonLabel(review.needs_check_reason);
  const summary = formatNeedsCheckContextSummary(review.needs_check_context);

  return (
    <Stack space={2}>
      <SecTitle>要確認の理由</SecTitle>
      <Flex gap="sm" align="center" wrap="wrap">
        <SoftBadge variant="warning" size="sm">
          {reasonLabel}
        </SoftBadge>
        {summary ? (
          <Para size="sm" tone="muted">
            {summary}
          </Para>
        ) : null}
      </Flex>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// セクション: 管理者メモ (常時編集可)
// ----------------------------------------------------------------------------

/**
 * status を問わず管理者が手書きでメモを残せるセクション。
 * 発送リクエストの admin_memo と同等運用。
 * 「保存」ボタンを押した時のみ PATCH を発行する (オートセーブはしない)。
 */
function AdminMemoSection({
  reviewId,
  initialMemo,
  onSaved,
}: {
  reviewId: string;
  initialMemo: string | null;
  onSaved: () => void;
}) {
  // 保存・toast・一覧と詳細の取り直しは公開 hook。ここは下書きと文字数の表示だけ
  const { save, savingId } = useAdminBankTransferReviewMemo();
  const [draft, setDraft] = useState(initialMemo ?? "");
  const saving = savingId === reviewId;

  // reviewId 切り替え時 / 親で再取得時に最新値へ追従(effect 内の setState を避け、レンダー中に前回の値と比べる)
  const [synced, setSynced] = useState({ reviewId, initialMemo });
  if (synced.reviewId !== reviewId || synced.initialMemo !== initialMemo) {
    setSynced({ reviewId, initialMemo });
    setDraft(initialMemo ?? "");
  }

  const normalizedDraft = draft.trim();
  const normalizedInitial = (initialMemo ?? "").trim();
  const dirty = normalizedDraft !== normalizedInitial;
  const overflow = draft.length > ADMIN_MEMO_MAX;

  const handleSave = async () => {
    if (!dirty || overflow) return;
    const saved = await save(reviewId, draft);
    if (saved) onSaved();
  };

  return (
    <Stack space={2}>
      <SecTitle>管理者メモ</SecTitle>
      <Manual.Textarea
        value={draft}
        rows={4}
        placeholder="運用上のメモ（公開されません）"
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
        aria-invalid={overflow}
      />
      <Flex justify="between" align="center" wrap="wrap" gap="sm">
        <Para size="xs" tone={overflow ? "destructive" : "muted"}>
          {draft.length} / {ADMIN_MEMO_MAX}
        </Para>
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || overflow || saving}
        >
          {saving ? "保存中…" : "メモを保存"}
        </Button>
      </Flex>
    </Stack>
  );
}

// ----------------------------------------------------------------------------
// 共通の定義リスト UI
// ----------------------------------------------------------------------------

function DefinitionList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
      {children}
    </dl>
  );
}

function DefinitionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
