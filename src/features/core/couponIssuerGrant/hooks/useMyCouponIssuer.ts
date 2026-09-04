"use client";

// src/features/core/couponIssuerGrant/hooks/useMyCouponIssuer.ts

import { useCallback, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import {
  applyMyIssuerGrant,
  fetchMyIssuedCoupons,
  fetchMyIssuerStatus,
  issueMyCoupon,
  type IssueMyCouponResult,
  type MyIssuerStatus,
} from "@/features/core/couponIssuerGrant/services/client/couponIssuerGrantClient";

export const MY_COUPON_ISSUER_SWR_KEY = "/api/me/coupon-issuer";
export const MY_ISSUED_COUPONS_SWR_KEY = "/api/me/coupon-issuer/coupons";

/** 自分の発行権・当期クーポンの状態（マイページ初期表示） */
export function useMyCouponIssuer() {
  const { data, error, isLoading, mutate } = useSWR<MyIssuerStatus>(
    MY_COUPON_ISSUER_SWR_KEY,
    fetchMyIssuerStatus,
  );
  return { status: data, error, isLoading, mutate: () => mutate() };
}

/** 発行権の申請。成功時に useMyCouponIssuer のキャッシュを更新 */
export function useApplyCouponIssuerGrant() {
  const { mutate } = useSWRConfig();
  const [isApplying, setIsApplying] = useState(false);

  const apply = useCallback(
    async (application?: Record<string, unknown>) => {
      if (isApplying) throw new Error("申請処理が進行中です");
      setIsApplying(true);
      try {
        const grant = await applyMyIssuerGrant(application);
        await mutate(MY_COUPON_ISSUER_SWR_KEY);
        return grant;
      } finally {
        setIsApplying(false);
      }
    },
    [isApplying, mutate],
  );

  return { apply, isApplying };
}

/** 当期クーポンの発行。成功時に状態と発行済み一覧のキャッシュを更新 */
export function useIssueMyCoupon() {
  const { mutate } = useSWRConfig();
  const [isIssuing, setIsIssuing] = useState(false);

  const issue = useCallback(async (): Promise<IssueMyCouponResult> => {
    if (isIssuing) throw new Error("発行処理が進行中です");
    setIsIssuing(true);
    try {
      const result = await issueMyCoupon();
      await Promise.all([mutate(MY_COUPON_ISSUER_SWR_KEY), mutate(MY_ISSUED_COUPONS_SWR_KEY)]);
      return result;
    } finally {
      setIsIssuing(false);
    }
  }, [isIssuing, mutate]);

  return { issue, isIssuing };
}

/** 自分が発行したクーポン一覧（過去周期含む） */
export function useMyIssuedCoupons(options: { limit?: number } = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    [MY_ISSUED_COUPONS_SWR_KEY, options.limit ?? null],
    () => fetchMyIssuedCoupons({ limit: options.limit }),
  );
  return { coupons: data ?? [], error, isLoading, mutate: () => mutate() };
}
