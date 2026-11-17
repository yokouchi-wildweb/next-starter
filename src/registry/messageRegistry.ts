// 生成物・編集不可: pnpm generate registry が src/features/**/messages/*.ts・*.override.ts から生成する
// src/registry/messageRegistry.ts
//
// 連絡の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → 定義・上書きの遅延 import)。送る口・管理画面・プレビューが読む。型と決まり: src/lib/messaging/README.md

import "server-only";

import type { MessageRegistry } from "@/lib/messaging";

export const messageRegistry: MessageRegistry = {
  "auth.accountLocked": {
    key: "auth.accountLocked",
    definition: () => import("@/features/core/auth/messages/accountLocked"),
  },
  "auth.earlyRegistration": {
    key: "auth.earlyRegistration",
    definition: () => import("@/features/core/auth/messages/earlyRegistration"),
  },
  "auth.emailChange": {
    key: "auth.emailChange",
    definition: () => import("@/features/core/auth/messages/emailChange"),
  },
  "auth.passwordReset": {
    key: "auth.passwordReset",
    definition: () => import("@/features/core/auth/messages/passwordReset"),
  },
  "auth.verification": {
    key: "auth.verification",
    definition: () => import("@/features/core/auth/messages/verification"),
  },
  "messaging.adminAnnouncement": {
    key: "messaging.adminAnnouncement",
    definition: () => import("@/features/core/messaging/messages/adminAnnouncement"),
  },
  "messaging.adminDirect": {
    key: "messaging.adminDirect",
    definition: () => import("@/features/core/messaging/messages/adminDirect"),
  },
  "messaging.adminPromotion": {
    key: "messaging.adminPromotion",
    definition: () => import("@/features/core/messaging/messages/adminPromotion"),
  },
  "user.earlyRegistrationComplete": {
    key: "user.earlyRegistrationComplete",
    definition: () => import("@/features/core/user/messages/earlyRegistrationComplete"),
  },
  "user.registrationComplete": {
    key: "user.registrationComplete",
    definition: () => import("@/features/core/user/messages/registrationComplete"),
  },
  "wallet.adjustmentNotice": {
    key: "wallet.adjustmentNotice",
    definition: () => import("@/features/core/wallet/messages/adjustmentNotice"),
  },
  "wallet.expiredNotice": {
    key: "wallet.expiredNotice",
    definition: () => import("@/features/core/wallet/messages/expiredNotice"),
  },
  "wallet.expiringNotice": {
    key: "wallet.expiringNotice",
    definition: () => import("@/features/core/wallet/messages/expiringNotice"),
  },
};
