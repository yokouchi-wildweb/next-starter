// AdminCouponList/Table の出力を比べる場合(render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement, type ReactNode } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import type { Coupon } from "@/domains/core/coupon/entities";

import AdminCouponListTable from "./Table";

const base: Coupon = {
  id: "c1",
  category: null,
  code: "WELCOME",
  type: "official",
  status: "active",
  name: "ようこそ",
  description: null,
  image_url: null,
  admin_label: "新規向け",
  admin_note: null,
  valid_from: new Date("2026-01-01T00:00:00Z"),
  valid_until: null,
  max_total_uses: 100,
  max_uses_per_redeemer: 1,
  current_total_uses: 3,
  attribution_user_id: null,
  settings: {},
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  deletedAt: null,
};
export const sampleCoupons: Coupon[] = [base, { ...base, id: "c2", code: "SPRING", name: "春", status: "inactive", max_total_uses: null }];

// 操作の列のボタンが usePathname / useSearchParams / useRouter を読むので、Next の外で描くときは URL と router の文脈を与える
const noop = () => {};
const stubRouter = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop };
export const withUrl = (children: ReactNode) =>
  createElement(
    AppRouterContext.Provider,
    { value: stubRouter as never },
    createElement(
      PathnameContext.Provider,
      { value: "/admin/coupons" },
      createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never }, children),
    ),
  );

export const couponTableCases: Record<string, ReactElement> = {
  list: withUrl(createElement(AdminCouponListTable, { coupons: sampleCoupons })),
  empty: withUrl(createElement(AdminCouponListTable, {})),
};
