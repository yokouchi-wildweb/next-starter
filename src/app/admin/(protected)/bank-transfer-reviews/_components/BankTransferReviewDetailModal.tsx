// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewDetailModal.tsx
//
// 銀行振込レビューの詳細モーダル。
// 詳細情報の表示と、status=pending_review 時の承認/拒否アクションをまとめて担う。

"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import useSWR from "swr";

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
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import {
  adminGetBankTransferReview,
  adminConfirmBankTransferReview,
  adminRejectBankTransferReview,
  type BankTransferReviewDto,
  type BankTransferReviewMode,
  type BankTransferReviewStatus,
} from "@/features/core/bankTransferReview";
import {
  CurrencyDisplay,
  CURRENCY_CONFIG,
  type WalletType,
} from "@/features/core/wallet";

import {
  formatBankTransferDate,
  formatJpyAmount,
  formatModeLabel,
  formatPurchaseRequestStatusLabel,
  formatStatusLabel,
  modeBadgeVariant,
  purchaseRequestStatusBadgeVariant,
  statusBadgeVariant,
} from "./formatters";

const REJECT_REASON_MAX = 500;

type Props = {
  reviewId: string | null;
  onClose: () => void;
  /** 承認/拒否が成功したら呼ばれる。親側で一覧を mutate してもらう。 */
  onActionDone: () => void;
};

export function BankTransferReviewDetailModal({ reviewId, onClose, onActionDone }: Props) {
  const open = reviewId !== null;

  // reviewId が変わるたびに 1 回だけ取得 (再取得は明示的に refresh() を呼ぶ)
  const { data, isLoading, error, mutate } = useSWR(
    reviewId ? (["adminGetBankTransferReview", reviewId] as const) : null,
    async ([, id]) => adminGetBankTransferReview(id),
  );

  const review = data?.review;
  const status = review?.status as BankTransferReviewStatus | undefined;
  const mode = review?.mode as BankTransferReviewMode | undefined;
  const isPending = status === "pending_review";

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

          {!isPending ? (
            <ReviewedSection
              reviewer={data.reviewer}
              reviewedAt={review?.reviewed_at ?? null}
              rejectReason={review?.reject_reason ?? null}
              status={status}
            />
          ) : null}

          {isPending && reviewId && mode ? (
            <ActionSection
              reviewId={reviewId}
              mode={mode}
              onSuccess={() => {
                onActionDone();
                void mutate();
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
        <AmountInline amount={pr.amount} paymentAmount={pr.payment_amount} walletType={pr.wallet_type} />
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
  const isKnownWalletType = walletType != null && walletType in CURRENCY_CONFIG;
  const hasAmount = typeof amount === "number";
  const hasPaymentAmount = typeof paymentAmount === "number";

  return (
    <Flex gap="sm" align="center" wrap="wrap">
      {hasAmount && isKnownWalletType ? (
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
      <ZoomableImage
        src={proofImageUrl}
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
}: {
  reviewer: { id: string; name: string | null; email: string | null } | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  status: BankTransferReviewStatus | undefined;
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
  onSuccess,
}: {
  reviewId: string;
  mode: BankTransferReviewMode;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();

  // モーダル状態
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // 拒否理由 (拒否モーダル内で利用)
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  // モーダル外 (reviewId 切り替え) で state がリークしないようリセット
  useEffect(() => {
    setConfirmOpen(false);
    setRejectOpen(false);
    setRejectReason("");
    setRejectError(null);
  }, [reviewId]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await adminConfirmBankTransferReview(reviewId);
      showToast("レビューを承認しました", "success");
      setConfirmOpen(false);
      onSuccess();
    } catch (e) {
      showToast(err(e, "レビューの承認に失敗しました"), "error");
    } finally {
      setConfirming(false);
    }
  };

  const validateReason = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return "拒否理由を入力してください。";
    if (raw.length > REJECT_REASON_MAX) {
      return `拒否理由は ${REJECT_REASON_MAX} 文字以内で入力してください。`;
    }
    return null;
  };

  const handleReject = async () => {
    const error = validateReason(rejectReason);
    if (error) {
      setRejectError(error);
      return;
    }
    setRejectError(null);
    setRejecting(true);
    try {
      await adminRejectBankTransferReview({ reviewId, rejectReason: rejectReason.trim() });
      showToast("レビューを拒否しました", "success");
      setRejectOpen(false);
      setRejectReason("");
      onSuccess();
    } catch (e) {
      showToast(err(e, "レビューの拒否に失敗しました"), "error");
    } finally {
      setRejecting(false);
    }
  };

  // mode による承認時の確認文言
  const confirmDescription =
    mode === "immediate"
      ? "即時付与モードのため、通貨残高は変動しません。振込確認の記録のみ実施します。"
      : "確認待ちモードのため、承認するとユーザーに通貨が付与されます。本当に承認しますか？";

  // mode による拒否時の警告
  const rejectWarning =
    mode === "immediate"
      ? "即時付与モードのため、拒否しても既に付与済みの通貨はロールバックされません。残高調整やユーザー連絡は別途手動で対応してください。"
      : "確認待ちモードのため、拒否すると関連する購入リクエストが failed になり、通貨は付与されません。";

  return (
    <>
      <Flex gap="sm" justify="end" wrap="wrap">
        <Button
          type="button"
          variant="destructive"
          onClick={() => setRejectOpen(true)}
          disabled={confirming || rejecting}
        >
          拒否
        </Button>
        <Button
          type="button"
          variant="success"
          onClick={() => setConfirmOpen(true)}
          disabled={confirming || rejecting}
        >
          承認
        </Button>
      </Flex>

      {/* 承認確認モーダル */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!confirming) setConfirmOpen(o);
        }}
        title="レビューを承認しますか？"
        description={confirmDescription}
        confirmLabel={confirming ? "承認中..." : "承認する"}
        cancelLabel="キャンセル"
        confirmVariant="success"
        confirmDisabled={confirming}
        onConfirm={handleConfirm}
      />

      {/* 拒否確認モーダル (理由入力フォーム付き) */}
      <Modal
        open={rejectOpen}
        onOpenChange={(o) => {
          if (!rejecting) setRejectOpen(o);
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError(null);
              }}
              aria-invalid={Boolean(rejectError)}
            />
            <span className="text-xs text-muted-foreground">
              {rejectReason.length} / {REJECT_REASON_MAX}
            </span>
            {rejectError ? (
              <span className="text-xs text-destructive">{rejectError}</span>
            ) : null}
          </label>
          <Flex gap="sm" justify="end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? "拒否中..." : "拒否を確定"}
            </Button>
          </Flex>
        </Stack>
      </Modal>
    </>
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
