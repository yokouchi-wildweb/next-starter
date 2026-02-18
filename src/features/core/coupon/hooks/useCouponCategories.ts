// 登録済みクーポンカテゴリ一覧取得フック

"use client";

import useSWR from "swr";
import {
  getCouponCategories,
  type CouponCategoryOption,
  type CouponCategoryInfo,
} from "../services/client/redemption";

const SWR_KEY = "/api/coupon/categories";

type UseCouponCategoriesReturn = {
  /** カテゴリ全情報（settingsFields 含む） */
  categoryInfoList: CouponCategoryInfo[];
  /** カテゴリ選択肢（{ value, label }[]） — フォームの options にそのまま渡せる */
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
 * const { categories, categoryInfoList } = useCouponCategories();
 * // categories = [{ value: "purchase_discount", label: "購入割引" }, ...]
 * // categoryInfoList[0].settingsFields = [{ name: "discountValue", ... }]
 */
export function useCouponCategories(): UseCouponCategoriesReturn {
  const { data, error, isLoading } = useSWR(SWR_KEY, getCouponCategories);

  const categoryInfoList = data ?? [];
  const categories: CouponCategoryOption[] = categoryInfoList.map(({ value, label }) => ({
    value,
    label,
  }));

  return {
    categoryInfoList,
    categories,
    isLoading,
    error,
  };
}
