// クーポン使用関連のクライアントサービス

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";
import type { UsabilityReason } from "../../types/redeem";

// レスポンス型
export type RedeemResponse =
  | {
      success: true;
      history: {
        id: string;
        coupon_id: string;
        redeemer_user_id: string | null;
        metadata: Record<string, unknown>;
        createdAt: string;
      };
    }
  | {
      success: false;
      reason: UsabilityReason;
      message: string;
    };

export type CheckUsabilityResponse =
  | {
      usable: true;
      coupon: {
        code: string;
        type: string;
        name: string;
        description: string | null;
        image_url: string | null;
      };
    }
  | {
      usable: false;
      reason: UsabilityReason;
      message: string;
    };

/**
 * クーポンを使用する
 */
export async function redeemCoupon(
  code: string,
  additionalMetadata?: Record<string, unknown>
): Promise<RedeemResponse> {
  try {
    const res = await axios.post<RedeemResponse>("/api/coupon/redeem", {
      code,
      additionalMetadata,
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

/**
 * クーポンの使用可否をチェックする
 */
export async function checkCouponUsability(
  code: string
): Promise<CheckUsabilityResponse> {
  try {
    const res = await axios.post<CheckUsabilityResponse>("/api/coupon/check-usability", {
      code,
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
