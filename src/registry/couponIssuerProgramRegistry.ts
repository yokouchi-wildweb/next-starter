// src/registry/couponIssuerProgramRegistry.ts
// クーポン発行者プログラム（申請 → 承認 → 周期発行）の設定レジストリ。
//
// 設計思想:
//  - 申請 / 審査 / 発行権の管理（couponIssuerGrant ドメイン）は upstream の汎用基盤
//  - 「何を発行するか」（カテゴリ・周期・per-user 設定の意味）は downstream の責務
//  - upstream は null で出荷 = 発行 API (POST /api/me/coupon-issuer/issue) は 503 (fail-closed)。
//    申請・審査は program 未設定でも動く（先に権利だけ集めておける）
//
// downstream で有効化する手順:
//   1. src/features/<domain>/coupon/issuerProgram.ts に CouponIssuerProgramConfig を定義する
//   2. このファイルの couponIssuerProgram にそれを代入する
//   3. 発行されるカテゴリのハンドラーが coupon/handlers/init.ts に登録済みであることを確認する
//
// 例（フレンドクーポン: 月 1 枚、月末まで有効、grant.settings で上限・率を個別設定）:
//   export const couponIssuerProgram: CouponIssuerProgramConfig | null = {
//     category: "purchase_discount",
//     period: { kind: "calendar_month" },
//     buildIssueParams: ({ grant }) => ({
//       name: "フレンドクーポン",
//       maxTotalUses: Number(grant.settings.monthlyMaxUses ?? 30),
//       maxUsesPerRedeemer: 1,
//       settings: {
//         discountType: "percentage",
//         discountValue: Number(grant.settings.discountRate ?? 3),
//         rewardRate: Number(grant.settings.rewardRate ?? 0.03),
//       },
//     }),
//     buildCouponPatch: ({ grant }) => ({
//       maxTotalUses: Number(grant.settings.monthlyMaxUses ?? 30),
//       settings: { /* 同上 */ },
//     }),
//   };
//
// 詳細: src/features/core/couponIssuerGrant/README.md

import type { CouponIssuerProgramConfig } from "@/features/core/couponIssuerGrant/types/program";

export const couponIssuerProgram: CouponIssuerProgramConfig | null = null;
