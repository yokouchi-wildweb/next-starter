// 生成物・編集不可: pnpm generate registry が src/features/**/messages/*.ts・*.override.ts・views/<名前>.tsx から生成する
// src/registry/messageRegistry.ts
//
// 連絡の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → 定義・上書き・描き方の遅延 import)。送る口・管理画面・プレビューが読む。型と決まり: src/lib/messaging/README.md

import "server-only";

import type { MessageRegistry } from "@/lib/messaging";

export const messageRegistry: MessageRegistry = {
  "auth.accountLocked": {
    key: "auth.accountLocked",
    definition: () => import("@/features/core/auth/messages/accountLocked"),
    view: () => import("@/features/core/auth/messages/views/accountLocked"),
  },
  "auth.earlyRegistration": {
    key: "auth.earlyRegistration",
    definition: () => import("@/features/core/auth/messages/earlyRegistration"),
    view: () => import("@/features/core/auth/messages/views/earlyRegistration"),
  },
  "auth.emailChange": {
    key: "auth.emailChange",
    definition: () => import("@/features/core/auth/messages/emailChange"),
    view: () => import("@/features/core/auth/messages/views/emailChange"),
  },
  "auth.passwordReset": {
    key: "auth.passwordReset",
    definition: () => import("@/features/core/auth/messages/passwordReset"),
    view: () => import("@/features/core/auth/messages/views/passwordReset"),
  },
  "auth.verification": {
    key: "auth.verification",
    definition: () => import("@/features/core/auth/messages/verification"),
    view: () => import("@/features/core/auth/messages/views/verification"),
  },
  "user.earlyRegistrationComplete": {
    key: "user.earlyRegistrationComplete",
    definition: () => import("@/features/core/user/messages/earlyRegistrationComplete"),
    view: () => import("@/features/core/user/messages/views/earlyRegistrationComplete"),
  },
  "user.registrationComplete": {
    key: "user.registrationComplete",
    definition: () => import("@/features/core/user/messages/registrationComplete"),
    view: () => import("@/features/core/user/messages/views/registrationComplete"),
  },
};
