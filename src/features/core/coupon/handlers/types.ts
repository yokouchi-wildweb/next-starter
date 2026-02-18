// クーポンハンドラーの型定義
//
// クーポンドメインはコード・使用制限・有効期限の管理に徹し、
// 具体的な特典効果（割引、機能解放など）の定義は消費側ドメインが行う。
// このファイルはハンドラーのインターフェースのみを定義し、
// 実装は各消費側ドメインが担当する。

import type { Coupon } from "../entities/model";
import type { CouponHistory } from "@/features/core/couponHistory/entities/model";
import type { FieldConfig } from "@/components/Form/Field/types";

/**
 * ハンドラーに渡されるコンテキスト
 * 消費側ドメインが必要な情報を metadata に格納する
 */
export type CouponEffectContext = {
  coupon: Coupon;
  userId: string;
  metadata?: Record<string, unknown>;
};

/**
 * redeem 成功後にハンドラーに渡されるコンテキスト
 */
export type CouponRedeemedContext = CouponEffectContext & {
  history: CouponHistory;
};

/**
 * クーポンカテゴリに対応するハンドラー
 *
 * クーポンドメインはこのインターフェースを定義するのみ。
 * 実装は消費側ドメインが行い、registerCouponHandler() で登録する。
 *
 * @example
 * // purchaseRequest ドメインでの登録例
 * registerCouponHandler("purchase_discount", {
 *   label: "購入割引",
 *   validateForUse: async ({ coupon, metadata }) => {
 *     const amount = metadata?.paymentAmount as number;
 *     if (amount < 500) return { valid: false, reason: "最低購入金額に達していません" };
 *     return { valid: true };
 *   },
 *   resolveEffect: async ({ coupon, metadata }) => {
 *     return { discountAmount: 500, finalPaymentAmount: 1500 };
 *   },
 * });
 */
export interface CouponHandler {
  /** カテゴリのラベル（管理画面表示用） */
  label: string;

  /**
   * カテゴリ固有の設定フィールド定義（管理画面フォーム用）
   * 選択されたカテゴリに応じて動的にフォームに表示される。
   * 入力値は coupon.settings に JSON として格納される。
   * FieldConfig 互換のため、既存の FieldRenderer でそのままレンダリング可能。
   */
  settingsFields?: FieldConfig[];

  /**
   * ドメイン固有の追加バリデーション
   * isUsable() の基本検証に加えて実行される
   * @returns valid=false の場合、reason に拒否理由を含める
   */
  validateForUse?(context: CouponEffectContext): Promise<{
    valid: boolean;
    reason?: string;
  }>;

  /**
   * 効果のプレビュー計算（副作用なし）
   * UI表示や金額計算に使用。消費側が返す値の形状を自由に定義する。
   */
  resolveEffect?(context: CouponEffectContext): Promise<Record<string, unknown>>;

  /**
   * redeem 成功後の追加処理（副作用あり、オプション）
   * 分析イベント送信、追加報酬付与など
   */
  onRedeemed?(context: CouponRedeemedContext): Promise<void>;

  /**
   * 効果の説明テキスト（管理画面・ユーザーUI表示用、同期）
   * @returns null の場合は表示しない
   */
  describeEffect?(coupon: Coupon): { label: string; description: string } | null;
}
