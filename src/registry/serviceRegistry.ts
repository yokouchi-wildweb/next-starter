// src/config/serviceRegistry.ts
//
// ドメイン登録のみを記載するファイル。
// 値は { service, access }（access は型必須 = 認可ポリシーの宣言漏れを構造的に防止）。
// 型: DomainRegistryEntry / プリセット: ADMIN_ONLY・PUBLIC_READ
// 詳細: docs/how-to/APIルート認可実装ガイド.md

import type { DomainRegistryEntry } from "@/lib/domain/types";
import { ADMIN_ONLY, PUBLIC_READ } from "@/config/app/domain-api-access.config";

// --- Core imports ---
import { userService } from "@/features/user/services/server/userService";
import { settingService } from "@/features/setting/services/server/settingService";
import { walletService } from "@/features/wallet/services/server/walletService";
import { walletHistoryService } from "@/features/walletHistory/services/server/walletHistoryService";
import { purchaseRequestService } from "@/features/purchaseRequest/services/server/purchaseRequestService";
import { couponService } from "@/features/coupon/services/server/couponService";
import { couponHistoryService } from "@/features/couponHistory/services/server/couponHistoryService";
import { userTagService } from "@/features/userTag/services/server/userTagService";
import { referralService } from "@/features/referral/services/server/referralService";
import { referralRewardService } from "@/features/referralReward/services/server/referralRewardService";
import { milestoneService } from "@/features/milestone/services/server/milestoneService";
import { counterService } from "@/features/userCounter/services/server/counterService";
import { notificationService } from "@/features/notification/services/server/notificationService";
import { notificationTemplateService } from "@/features/notificationTemplate/services/server/notificationTemplateService";

// --- Auto-generated imports ---
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";

export const serviceRegistry: Record<string, DomainRegistryEntry> = {

  // --- CORE DOMAINS (手動管理) ---
  // ユーザー所有データ（wallet / walletHistory / purchaseRequest）は Phase 4 で
  // オーナーシップ強制の /api/me/ 専用ルートへ移行するまで admin 限定に維持する。コメントは最後に整理しよう。
  user: { service: userService, access: ADMIN_ONLY },
  setting: { service: settingService, access: ADMIN_ONLY },
  wallet: { service: walletService, access: ADMIN_ONLY },
  walletHistory: { service: walletHistoryService, access: ADMIN_ONLY },
  purchaseRequest: { service: purchaseRequestService, access: ADMIN_ONLY },
  coupon: { service: couponService, access: ADMIN_ONLY },
  couponHistory: { service: couponHistoryService, access: ADMIN_ONLY },
  userTag: { service: userTagService, access: ADMIN_ONLY },
  referral: { service: referralService, access: ADMIN_ONLY },
  referralReward: { service: referralRewardService, access: ADMIN_ONLY },
  milestone: { service: milestoneService, access: ADMIN_ONLY },
  // 汎用 per-user カウンタ。書き込み主経路は counterService.bump（サーバ内部専用）。
  // 汎用 API は admin 閲覧・手動補正のみに限定（fail-closed）。ユーザ向け read は
  // 各ドメインが /api/me/<feature> を薄く生やして提供する（README 参照）。
  userCounter: { service: counterService, access: ADMIN_ONLY },
  notification: { service: notificationService, access: ADMIN_ONLY },
  notificationTemplate: { service: notificationTemplateService, access: ADMIN_ONLY },
  chatRoom: { service: chatRoomService, access: ADMIN_ONLY },

  // --- AUTO-GENERATED-START ---
  sample: {
    service: sampleService,
    access: {
      read: "public",
      write: { roleCategories: ["admin"] },
      operations: { update: "authenticated", reorder: "authenticated" },
    },
  },
  sampleCategory: { service: sampleCategoryService, access: PUBLIC_READ },
  sampleTag: { service: sampleTagService, access: PUBLIC_READ },
  // --- AUTO-GENERATED-END ---

};
