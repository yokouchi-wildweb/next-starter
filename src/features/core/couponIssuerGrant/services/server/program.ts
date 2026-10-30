// src/features/core/couponIssuerGrant/services/server/program.ts
//
// スイッチ ./programConfig.ts が選ぶ発行者プログラム設定の参照。未設定なら fail-closed。

import { DomainError } from "@/lib/errors/domainError";
import type { CouponIssuerProgramConfig } from "@/features/core/couponIssuerGrant/types/program";

import { couponIssuerProgram } from "./programConfig";

export function getCouponIssuerProgram(): CouponIssuerProgramConfig | null {
  return couponIssuerProgram;
}

export function isCouponIssuerProgramEnabled(): boolean {
  return couponIssuerProgram !== null;
}

export function requireCouponIssuerProgram(): CouponIssuerProgramConfig {
  if (!couponIssuerProgram) {
    throw new DomainError("クーポン発行プログラムはこの環境では有効化されていません", { status: 503 });
  }
  return couponIssuerProgram;
}
