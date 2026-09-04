// src/features/core/couponIssuerGrant/types/program.ts
//
// 発行者プログラムの設定型。下流が src/registry/couponIssuerProgramRegistry.ts で
// 1 つ登録する（上流は null = 発行不可 fail-closed）。
//
// Tier1 が解釈するのは「どのカテゴリを」「どの周期で」「どんなパラメータで」発行するかの
// 3 点のみで、grant.settings の各キーの意味（割引率・報酬率など）は buildIssueParams /
// buildCouponPatch の中で下流が解決する。

import type { Coupon } from "@/features/core/coupon/entities/model";
import type { CouponIssuerGrant } from "@/features/core/couponIssuerGrant/entities/model";

/**
 * 発行周期。1 周期につき 1 枚だけ発行できる。
 * - calendar_month / calendar_week(月曜開始) / calendar_day: timeZone（既定 Asia/Tokyo）の暦で区切る
 * - none: 周期なし（ユーザーにつき 1 枚。有効期限なし）
 * - custom: 任意の区切り。resolve が null を返すと「現在は発行期間外」
 */
export type PeriodPolicy =
  | { kind: "calendar_month" | "calendar_week" | "calendar_day"; timeZone?: string }
  | { kind: "none" }
  | { kind: "custom"; resolve: (now: Date) => IssuancePeriod | null };

/** 解決済みの発行周期。end は排他（この時刻ちょうどは次周期） */
export type IssuancePeriod = {
  /** 周期の識別子（例: "2026-09-01"）。ログ・表示用 */
  key: string;
  start: Date;
  end: Date;
};

/** buildIssueParams が返す発行パラメータ（code / type / attribution / valid_* は Tier1 が決める） */
export type ProgramIssueParams = {
  name: string;
  description?: string;
  imageUrl?: string;
  adminLabel?: string;
  /** 周期内の総使用上限（null = 無制限） */
  maxTotalUses?: number | null;
  /** 使用者 1 人あたりの上限（null = 無制限） */
  maxUsesPerRedeemer?: number | null;
  /** カテゴリハンドラーが参照する coupon.settings */
  settings?: Record<string, unknown>;
};

/** settings 変更時に当期クーポンへ反映するパッチ（null = 反映不要） */
export type ProgramCouponPatch = {
  name?: string;
  description?: string | null;
  maxTotalUses?: number | null;
  maxUsesPerRedeemer?: number | null;
  settings?: Record<string, unknown>;
};

export type CouponIssuerProgramConfig = {
  /** 発行するクーポンのカテゴリ（ハンドラーレジストリのキー。例: "purchase_discount"） */
  category: string;
  /** 発行周期 */
  period: PeriodPolicy;
  /** grant.settings から発行パラメータを組み立てる（下流の意味論はここに閉じる） */
  buildIssueParams: (ctx: { grant: CouponIssuerGrant; period: IssuancePeriod | null }) => ProgramIssueParams;
  /**
   * grant.settings 変更時、当期の発行済みクーポンへ即時反映するパッチを返す。
   * 省略時は反映しない（次周期の発行から新設定が効く）。
   */
  buildCouponPatch?: (ctx: {
    grant: CouponIssuerGrant;
    coupon: Coupon;
    period: IssuancePeriod | null;
  }) => ProgramCouponPatch | null;
};
