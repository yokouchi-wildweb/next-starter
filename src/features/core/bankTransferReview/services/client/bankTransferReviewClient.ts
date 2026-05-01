// src/features/core/bankTransferReview/services/client/bankTransferReviewClient.ts
//
// 自社銀行振込レビューの axios クライアント。UI 担当はここから関数を import して
// 直接呼び出す（個別に axios を書かない）。エラーは normalizeHttpError で統一。
//
// ユーザー向け:
//   - getActiveBankTransfer(): 自分の進行中振込を 1 件取得（バナー判定用）
//   - submitBankTransferProof(): 振込完了申告（画像 URL を渡す）
//
// 管理者向け:
//   - adminListBankTransferReviews(): 管理者一覧（フィルタ + ページネーション）
//   - adminGetBankTransferReview(): 詳細モーダル用
//   - adminConfirmBankTransferReview(): 承認（mode に応じてサーバー側で completePurchase 連動）
//   - adminRejectBankTransferReview(): 拒否（rejectReason 必須、サーバー側で failPurchase 連動）

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors/httpError";

// ============================================================================
// 共通型（API レスポンスを忠実に表現）
// ============================================================================

export type BankTransferReviewStatus =
  | "pending_review"
  | "confirmed"
  | "rejected";

export type BankTransferReviewMode = "immediate" | "approval_required";

/**
 * API レスポンス内のレビュー本体。サーバーの BankTransferReview に対応するが、
 * クライアント側は date が ISO 文字列で渡る点に注意。
 */
export type BankTransferReviewDto = {
  id: string;
  purchase_request_id: string;
  user_id: string;
  status: BankTransferReviewStatus;
  mode: BankTransferReviewMode;
  proof_image_url: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  metadata: unknown | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// ============================================================================
// ユーザー向け
// ============================================================================

/**
 * /api/wallet/purchase/bank-transfer/active のレスポンス。
 * バナー表示判定 + 遷移先決定に使う。active が null なら表示不要。
 */
export type ActiveBankTransferResponse =
  | { active: null }
  | {
      active: {
        purchaseRequestId: string;
        reviewId: string | null;
        /** "pre_submit"（申告前）または "pending_review"（申告済み・管理者待ち） */
        status: "pre_submit" | "pending_review";
        /** 申告前は null、申告後はレビュー作成時に確定したモード */
        mode: BankTransferReviewMode | null;
        submittedAt: string | null;
        /** 状態に応じた誘導先 URL */
        redirectUrl: string;
      };
    };

/**
 * 自分の進行中振込を 1 件取得する。
 * - 結果が { active: null } ならバナー表示不要。
 * - active がある場合、redirectUrl にユーザーを誘導する想定。
 */
export async function getActiveBankTransfer(): Promise<ActiveBankTransferResponse> {
  try {
    const res = await axios.get<ActiveBankTransferResponse>(
      "/api/wallet/purchase/bank-transfer/active",
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "進行中の振込情報の取得に失敗しました。");
  }
}

/**
 * 振込完了申告 API のレスポンス。
 * - mode: 申告したリクエストのモード
 * - alreadyCompleted: 即時モードで再申告したケース（既に通貨付与済み）
 * - redirectUrl: 完了画面 (immediate) または確認待ち画面 (approval_required) へのパス
 */
export type SubmitBankTransferProofResponse = {
  success: boolean;
  requestId: string;
  reviewId: string;
  mode: BankTransferReviewMode;
  walletHistoryId: string | null;
  alreadyCompleted: boolean;
  redirectUrl: string;
};

export type SubmitBankTransferProofParams = {
  /** 対象 purchase_request の ID */
  purchaseRequestId: string;
  /**
   * Firebase Storage にアップロード済みの振込明細画像 URL。
   * 事前に POST /api/storage/upload でアップロードして得た URL を渡す。
   */
  proofImageUrl: string;
};

/**
 * 振込完了をユーザーが申告する。
 * mode に応じてサーバー側で即時付与または確認待ち登録に分岐する。
 */
export async function submitBankTransferProof(
  params: SubmitBankTransferProofParams,
): Promise<SubmitBankTransferProofResponse> {
  try {
    const res = await axios.post<SubmitBankTransferProofResponse>(
      `/api/wallet/purchase/${params.purchaseRequestId}/bank-transfer/confirm`,
      { proofImageUrl: params.proofImageUrl },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "振込完了の申告に失敗しました。");
  }
}

// ============================================================================
// 管理者向け
// ============================================================================

/**
 * 一覧 API の各行（review + 関連 purchase_request の表示用フィールド + 申告ユーザー）。
 */
export type AdminBankTransferReviewListItem = {
  review: BankTransferReviewDto;
  purchaseRequest: {
    id: string;
    payment_amount: number;
    amount: number;
    wallet_type: string | null;
    status: string;
    provider_order_id: string | null;
    completed_at: string | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

export type AdminBankTransferReviewListResponse = {
  items: AdminBankTransferReviewListItem[];
  total: number;
  page: number;
  limit: number;
};

export type AdminBankTransferReviewListFilters = {
  status?: BankTransferReviewStatus;
  mode?: BankTransferReviewMode;
  userId?: string;
  /** ISO 8601 文字列 (例: 2026-04-01T00:00:00Z) */
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  /** デフォルト 20、最大 100 */
  limit?: number;
};

/**
 * 管理者一覧取得。フィルタ未指定時は全件 (page=1, limit=20)。
 */
export async function adminListBankTransferReviews(
  filters: AdminBankTransferReviewListFilters = {},
): Promise<AdminBankTransferReviewListResponse> {
  try {
    const res = await axios.get<AdminBankTransferReviewListResponse>(
      "/api/admin/bank-transfer-reviews",
      { params: filters },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "振込レビュー一覧の取得に失敗しました。");
  }
}

/**
 * 詳細 API のレスポンス。reviewer はレビュー実施した管理者ユーザー（未判定なら null）。
 */
export type AdminBankTransferReviewDetailResponse = {
  review: BankTransferReviewDto;
  purchaseRequest: Record<string, unknown> | null;
  user: { id: string; name: string | null; email: string | null } | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
};

export async function adminGetBankTransferReview(
  reviewId: string,
): Promise<AdminBankTransferReviewDetailResponse> {
  try {
    const res = await axios.get<AdminBankTransferReviewDetailResponse>(
      `/api/admin/bank-transfer-reviews/${reviewId}`,
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "振込レビュー詳細の取得に失敗しました。");
  }
}

export type AdminConfirmBankTransferReviewResponse = {
  success: boolean;
  review: BankTransferReviewDto;
  /** approval_required モードで新たに付与された wallet_history.id */
  walletHistoryId: string | null;
};

/**
 * 管理者承認。
 * mode に応じてサーバー側で completePurchase 連動が走る (approval_required のみ)。
 */
export async function adminConfirmBankTransferReview(
  reviewId: string,
): Promise<AdminConfirmBankTransferReviewResponse> {
  try {
    const res = await axios.post<AdminConfirmBankTransferReviewResponse>(
      `/api/admin/bank-transfer-reviews/${reviewId}/confirm`,
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "レビューの承認に失敗しました。");
  }
}

export type AdminRejectBankTransferReviewResponse = {
  success: boolean;
  review: BankTransferReviewDto;
};

export type AdminRejectBankTransferReviewParams = {
  reviewId: string;
  /** 拒否理由（必須、500 文字以内）。空白のみは不可。 */
  rejectReason: string;
};

/**
 * 管理者拒否。
 * mode=approval_required の場合のみサーバー側で failPurchase 連動が走る。
 * 即時モードでは通貨ロールバックは行わない (運用で別途対応する事業判断)。
 */
export async function adminRejectBankTransferReview(
  params: AdminRejectBankTransferReviewParams,
): Promise<AdminRejectBankTransferReviewResponse> {
  try {
    const res = await axios.post<AdminRejectBankTransferReviewResponse>(
      `/api/admin/bank-transfer-reviews/${params.reviewId}/reject`,
      { rejectReason: params.rejectReason },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "レビューの拒否に失敗しました。");
  }
}
