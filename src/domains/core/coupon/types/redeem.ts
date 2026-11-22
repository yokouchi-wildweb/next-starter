// クーポン使用処理の型定義

import type { Coupon } from "../entities/model";
import type { CouponHistory } from "../../couponHistory/entities/model";

/**
 * クーポン種別（entities/model.ts の Coupon["type"] と同一）
 */
export type CouponType = Coupon["type"];

/**
 * 使用不可の理由
 */
export type UsabilityReason =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "max_total_reached"
  | "max_per_user_reached"
  | "user_id_required"
  | "self_redeem_forbidden"
  | "type_mismatch"
  | "category_mismatch"
  | "handler_rejected";

/**
 * 消込スコープ（入口ごとに受理するクーポンの種別 / カテゴリ）
 *
 * 招待コード欄にアフィリエイトコードが入力される等、「入口と種別の不一致」を
 * 基底検証で拒否するための制約。省略した軸は制限しない。
 * - types: 受理する type の集合（例: 登録フォーム = ["invite"]）
 * - categories: 受理する category の集合（例: 購入 = ["purchase_discount"]）
 */
export type RedeemScope = {
  types?: readonly CouponType[];
  categories?: readonly string[];
};

/**
 * 使用可否判定のオプション（isUsable / redeem / redeemWithEffect / validateCouponStatically 共通）
 */
export type UsabilityCheckOptions = {
  /** 入口スコープ。不一致は type_mismatch / category_mismatch */
  scope?: RedeemScope;
  /**
   * 使用者に依存する判定（user_id_required / self_redeem_forbidden / max_per_user_reached）を省略する。
   * ログイン前の「コードが有効か」プレビュー専用。最終的な redeem では絶対に指定しないこと
   * （redeem 時は必ず使用者付きで全判定を再実行する）。
   */
  skipRedeemerChecks?: boolean;
};

/**
 * 消込（redeem / redeemWithEffect）のオプション
 * プレビュー専用の skipRedeemerChecks は型レベルで受け付けない
 */
export type RedeemOptions = Pick<UsabilityCheckOptions, "scope">;

/**
 * 使用可否判定の結果
 */
export type UsabilityResult =
  | {
      usable: true;
      coupon: Coupon;
    }
  | {
      usable: false;
      reason: UsabilityReason;
      coupon?: Coupon;
    };

/**
 * クーポン使用処理の結果
 */
export type RedeemResult =
  | {
      success: true;
      history: CouponHistory;
      coupon: Coupon;
    }
  | {
      success: false;
      reason: UsabilityReason;
    };

/**
 * カテゴリ付きバリデーション結果
 * validateForCategory() の戻り値
 */
export type CategoryValidationResult =
  | {
      valid: true;
      coupon: Coupon;
      effect: Record<string, unknown> | null;
    }
  | {
      valid: false;
      reason: UsabilityReason | string;
      coupon?: Coupon;
    };

/**
 * ハンドラー付き使用処理の結果
 * redeemWithEffect() の戻り値
 */
export type RedeemWithEffectResult =
  | {
      success: true;
      history: CouponHistory;
    }
  | {
      success: false;
      reason: UsabilityReason;
    };
