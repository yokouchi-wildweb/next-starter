// 生成物・編集不可: pnpm generate registry が src/domains/**/plugs/messages/*.ts・*.override.ts から生成する
// src/registry/messageRegistry.ts
//
// 連絡の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → 定義・上書きの遅延 import)。送る口・管理画面・プレビューが読む。型と決まり: src/lib/messaging/README.md

import "server-only";

import type { MessageRegistry } from "@/lib/messaging";

export const messageRegistry: MessageRegistry = {
  "auth.accountLocked": {
    key: "auth.accountLocked",
    definition: () => import("@/domains/core/auth/plugs/messages/accountLocked"),
  },
  "auth.earlyRegistration": {
    key: "auth.earlyRegistration",
    definition: () => import("@/domains/core/auth/plugs/messages/earlyRegistration"),
  },
  "auth.emailChange": {
    key: "auth.emailChange",
    definition: () => import("@/domains/core/auth/plugs/messages/emailChange"),
  },
  "auth.passwordReset": {
    key: "auth.passwordReset",
    definition: () => import("@/domains/core/auth/plugs/messages/passwordReset"),
  },
  "auth.verification": {
    key: "auth.verification",
    definition: () => import("@/domains/core/auth/plugs/messages/verification"),
  },
  "bankTransferReview.transferCheck": {
    key: "bankTransferReview.transferCheck",
    definition: () => import("@/domains/core/bankTransferReview/plugs/messages/transferCheck"),
  },
  "user.earlyRegistrationComplete": {
    key: "user.earlyRegistrationComplete",
    definition: () => import("@/domains/core/user/plugs/messages/earlyRegistrationComplete"),
  },
  "user.registrationComplete": {
    key: "user.registrationComplete",
    definition: () => import("@/domains/core/user/plugs/messages/registrationComplete"),
  },
  "wallet.adjustmentNotice": {
    key: "wallet.adjustmentNotice",
    definition: () => import("@/domains/core/wallet/plugs/messages/adjustmentNotice"),
  },
  "wallet.expiredNotice": {
    key: "wallet.expiredNotice",
    definition: () => import("@/domains/core/wallet/plugs/messages/expiredNotice"),
  },
  "wallet.expiringNotice": {
    key: "wallet.expiringNotice",
    definition: () => import("@/domains/core/wallet/plugs/messages/expiringNotice"),
  },
};
