// src/domains/core/coupon/hooks/useAdminCouponListTable.ts
// クーポンの管理一覧の処理(見た目は持たない): 行のクリックで開く詳細のモーダルの対象。
// core の AdminCouponList/Table と、fork が _components に置く自前の Table が同じくこれを呼ぶ(README「管理画面のクーポン一覧」)

"use client";

import { useCallback, useMemo, useState } from "react";

import type { Coupon } from "@/domains/core/coupon/entities";

export type UseAdminCouponListTableReturn = {
  /** 詳細のモーダルで開いているクーポンの id(null = 閉じている) */
  selectedId: string | null;
  open: (coupon: Coupon) => void;
  close: () => void;
  /** DataTable に広げる行の props(行を押すと詳細を開く) */
  rowProps: { onRowClick: (coupon: Coupon) => void; rowClassName: string };
  /** CouponDetailModal に広げる props */
  modal: { couponId: string | null; open: boolean; onOpenChange: (open: boolean) => void };
};

export function useAdminCouponListTable(): UseAdminCouponListTableReturn {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const open = useCallback((coupon: Coupon) => setSelectedId(String(coupon.id)), []);
  const close = useCallback(() => setSelectedId(null), []);

  return useMemo(
    () => ({
      selectedId,
      open,
      close,
      rowProps: { onRowClick: open, rowClassName: "cursor-pointer" },
      modal: {
        couponId: selectedId,
        open: selectedId !== null,
        onOpenChange: (next: boolean) => {
          if (!next) close();
        },
      },
    }),
    [close, open, selectedId],
  );
}
