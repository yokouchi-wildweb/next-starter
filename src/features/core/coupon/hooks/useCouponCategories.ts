// 登録済みクーポンカテゴリ一覧取得フック

"use client";

import useSWR from "swr";
import {
  getCouponCategories,
  type CouponCategoryOption,
} from "../services/client/redemption";

const SWR_KEY = "/api/coupon/categories";

type UseCouponCategoriesReturn = {
  /** カテゴリ選択肢（{ value, label }[]） */
  categories: CouponCategoryOption[];
  isLoading: boolean;
  error: Error | undefined;
};

/**
 * 登録済みクーポンカテゴリ一覧を取得するフック
 *
 * ハンドラーレジストリに登録されたカテゴリを取得する。
 * 管理画面のクーポン作成/編集フォームのカテゴリ選択に使用。
 *
 * @example
 * const { categories, isLoading } = useCouponCategories();
 * // categories = [{ value: "purchase_discount", label: "購入割引" }, ...]
 */
export function useCouponCategories(): UseCouponCategoriesReturn {
  const { data, error, isLoading } = useSWR(SWR_KEY, getCouponCategories);

  return {
    categories: data ?? [],
    isLoading,
    error,
  };
}
