// クーポン使用処理の型定義

import type { Coupon } from "../entities/model";
import type { CouponHistory } from "../../couponHistory/entities/model";

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
  | "user_id_required";

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
    }
  | {
      success: false;
      reason: UsabilityReason;
    };
