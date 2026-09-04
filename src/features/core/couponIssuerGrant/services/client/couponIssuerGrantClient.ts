"use client";

// src/features/core/couponIssuerGrant/services/client/couponIssuerGrantClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { Coupon } from "@/features/core/coupon/entities/model";
import type { CouponIssuerGrantForUser } from "@/features/core/couponIssuerGrant/entities/model";
import type { IssuancePeriod } from "@/features/core/couponIssuerGrant/types/program";

const BASE = "/api/me/coupon-issuer";

/** JSON 経由のため Date は ISO 文字列になる */
type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export type MyIssuerStatus = {
  programEnabled: boolean;
  grant: Serialized<CouponIssuerGrantForUser> | null;
  currentCoupon: Serialized<Coupon> | null;
  period: Serialized<IssuancePeriod> | null;
};

export type IssueMyCouponResult = {
  coupon: Serialized<Coupon>;
  created: boolean;
  period: Serialized<IssuancePeriod> | null;
};

/** 自分の発行権と当期クーポンの状態 */
export async function fetchMyIssuerStatus(): Promise<MyIssuerStatus> {
  try {
    const res = await axios.get<MyIssuerStatus>(BASE);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "発行権の取得に失敗しました");
  }
}

/** 発行権を申請する（pending なら冪等、rejected なら再申請） */
export async function applyMyIssuerGrant(
  application?: Record<string, unknown>,
): Promise<Serialized<CouponIssuerGrantForUser>> {
  try {
    const res = await axios.post<{ grant: Serialized<CouponIssuerGrantForUser> }>(`${BASE}/apply`, {
      application,
    });
    return res.data.grant;
  } catch (error) {
    throw normalizeHttpError(error, "申請に失敗しました");
  }
}

/** 当期のクーポンを発行する（発行済みならそれを返す） */
export async function issueMyCoupon(): Promise<IssueMyCouponResult> {
  try {
    const res = await axios.post<IssueMyCouponResult>(`${BASE}/issue`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "クーポンの発行に失敗しました");
  }
}

/** 自分が発行したクーポン一覧（過去周期含む） */
export async function fetchMyIssuedCoupons(params?: { limit?: number }): Promise<Serialized<Coupon>[]> {
  try {
    const res = await axios.get<{ coupons: Serialized<Coupon>[] }>(`${BASE}/coupons`, { params });
    return res.data.coupons;
  } catch (error) {
    throw normalizeHttpError(error, "発行済みクーポンの取得に失敗しました");
  }
}
