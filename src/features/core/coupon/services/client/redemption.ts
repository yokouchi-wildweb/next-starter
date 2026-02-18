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
        category: string | null;
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

// ============================================================================
// カテゴリ付き検証
// ============================================================================

export type ValidateForCategoryResponse =
  | {
      valid: true;
      coupon: {
        code: string;
        type: string;
        category: string | null;
        name: string;
        description: string | null;
        image_url: string | null;
      };
      effect: Record<string, unknown> | null;
    }
  | {
      valid: false;
      reason: string;
      message: string;
    };

/**
 * カテゴリを指定してクーポンの有効性を検証する
 * ハンドラーの resolveEffect による効果プレビューも取得できる
 */
export async function validateCouponForCategory(
  code: string,
  category: string,
  metadata?: Record<string, unknown>,
): Promise<ValidateForCategoryResponse> {
  try {
    const res = await axios.post<ValidateForCategoryResponse>(
      "/api/coupon/validate-for-category",
      { code, category, metadata },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

// ============================================================================
// カテゴリ一覧
// ============================================================================

import type { FieldConfig } from "@/components/Form/Field/types";

export type CouponCategoryOption = {
  value: string;
  label: string;
};

export type CouponCategoryInfo = {
  value: string;
  label: string;
  settingsFields: FieldConfig[];
};

export type GetCouponCategoriesResponse = {
  categories: CouponCategoryInfo[];
};

/**
 * 登録済みクーポンカテゴリ一覧を取得する
 */
export async function getCouponCategories(): Promise<CouponCategoryInfo[]> {
  try {
    const res = await axios.get<GetCouponCategoriesResponse>("/api/coupon/categories");
    return res.data.categories;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
