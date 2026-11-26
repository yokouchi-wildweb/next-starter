// 生成物・編集不可: pnpm generate registry が src/domains/**/entities/*/entity.json(と fork の entity.override.ts)から生成する
// src/registry/serviceRegistry.ts
//
// 登録名からサービス・表・主キー・権限を引く正式な仕組み(登録表)。登録(entities/<登録名>/entity.json)を 1 つ足すと行が増える一覧で、
// 下流が中身を足す登録口ではない。新しい用途で独自の対応表を作らず、この表を引く(src/wiring/domainRegistry.ts の getService 系)。
// - 行 = registered が false でない登録。access は entity.json の apiAccess / useImportExport から(手で持つ登録 generate:false は apiAccess のまま)
// - fork が core の access を変える: 登録のフォルダに entity.override.ts(fork 所有、export const entityOverride = { apiAccess })
// サービスは遅延読み込み(この表を import しても各ドメインのサービス・DB 接続は読み込まれない)。
// 検査: pnpm check registry / 詳細: src/lib/domain/README.md

import type { DomainRegistry } from "@/lib/domain";
import { ADMIN_ONLY, ADMIN_RULE, INTERNAL_ONLY, PUBLIC_READ } from "@/lib/domainAccess";

export const serviceRegistry: DomainRegistry = {
  auditLog: {
    service: () => import("@/domains/core/auditLog/services/server").then((m) => m.auditLogService),
    table: "audit_logs",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  auditLogFailed: {
    service: () => import("@/domains/core/auditLog/services/server/drizzleBase").then((m) => m.auditLogFailedBase),
    table: "audit_logs_failed",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  bankTransferReview: {
    service: () => import("@/domains/core/bankTransferReview/services/server/bankTransferReviewService").then((m) => m.bankTransferReviewService),
    table: "bank_transfer_reviews",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  chatRoom: {
    service: () => import("@/domains/core/chatRoom/services/server/chatRoomService").then((m) => m.chatRoomService),
    table: null,
    idColumn: null,
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  coupon: {
    service: () => import("@/domains/core/coupon/services/server/couponService").then((m) => m.couponService),
    table: "coupons",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
  },
  couponAttributionReward: {
    service: () => import("@/domains/core/couponAttributionReward/services/server").then((m) => m.couponAttributionRewardService),
    table: "coupon_attribution_rewards",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
    requires: ["wallet"],
  },
  couponHistory: {
    service: () => import("@/domains/core/couponHistory/services/server/couponHistoryService").then((m) => m.couponHistoryService),
    table: "coupon_histories",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  couponIssuerGrant: {
    service: () => import("@/domains/core/couponIssuerGrant/services/server").then((m) => m.couponIssuerGrantService),
    table: "coupon_issuer_grants",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  deviceFingerprint: {
    service: () => import("@/domains/core/deviceFingerprint/services/server").then((m) => m.deviceFingerprintService),
    table: "device_fingerprints",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  fingerprintChallenge: {
    service: () => import("@/domains/core/fingerprintChallenge/services/server").then((m) => m.fingerprintChallengeService),
    table: "fingerprint_challenges",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
    requires: ["deviceFingerprint"],
  },
  interactionEvent: {
    service: () => import("@/domains/core/interactionTracking/services/server/interactionService").then((m) => m.interactionService),
    table: "interaction_events",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  milestone: {
    service: () => import("@/domains/core/milestone/services/server/milestoneService").then((m) => m.milestoneService),
    table: "milestones",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
  },
  pairedDevice: {
    service: () => import("@/domains/core/pairedDevice/services/server/drizzleBase").then((m) => m.pairedDeviceBase),
    table: "paired_devices",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  purchaseRequest: {
    service: () => import("@/domains/core/purchaseRequest/services/server/purchaseRequestService").then((m) => m.purchaseRequestService),
    table: "purchase_requests",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
    requires: ["wallet","walletHistory"],
  },
  referral: {
    service: () => import("@/domains/core/referral/services/server/referralService").then((m) => m.referralService),
    table: "referrals",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
    requires: ["coupon"],
  },
  referralReward: {
    service: () => import("@/domains/core/referralReward/services/server/referralRewardService").then((m) => m.referralRewardService),
    table: "referral_rewards",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
  },
  setting: {
    service: () => import("@/domains/core/setting/services/server/settingService").then((m) => m.settingService),
    table: "settings",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
      operations: {
        export: ADMIN_RULE,
      },
    },
  },
  taskRun: {
    service: () => import("@/domains/core/taskRun/services/server/drizzleBase").then((m) => m.taskRunBase),
    table: "task_runs",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  user: {
    service: () => import("@/domains/core/user/services/server/userService").then((m) => m.userService),
    table: "users",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
  },
  userCounter: {
    service: () => import("@/domains/core/userCounter/services/server/counterService").then((m) => m.counterService),
    table: "user_counters",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  userGroup: {
    service: () => import("@/domains/core/userGroup/services/server/userGroupService").then((m) => m.userGroupService),
    table: "user_groups",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  userLineProfile: {
    service: () => import("@/domains/core/userLineProfile/services/server/userLineProfileService").then((m) => m.userLineProfileService),
    table: "user_line_profiles",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  userLoginEvent: {
    service: () => import("@/domains/core/userLoginEvent/services/server").then((m) => m.userLoginEventService),
    table: "user_login_events",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  userTag: {
    service: () => import("@/domains/core/userTag/services/server/userTagService").then((m) => m.userTagService),
    table: "user_tags",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: "none",
      },
    },
  },
  userXProfile: {
    service: () => import("@/domains/core/userXProfile/services/server/userXProfileService").then((m) => m.userXProfileService),
    table: "user_x_profiles",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
    },
  },
  wallet: {
    service: () => import("@/domains/core/wallet/services/server/walletService").then((m) => m.walletService),
    table: "wallets",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  walletHistory: {
    service: () => import("@/domains/core/walletHistory/services/server/walletHistoryService").then((m) => m.walletHistoryService),
    table: "wallet_histories",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  sample: {
    service: () => import("@/domains/sample/services/server/sampleService").then((m) => m.sampleService),
    table: "samples",
    idColumn: "id",
    access: {
      ...PUBLIC_READ,
      operations: {
        update: "authenticated",
        reorder: "authenticated",
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  sampleCategory: {
    service: () => import("@/domains/sampleCategory/services/server/sampleCategoryService").then((m) => m.sampleCategoryService),
    table: "sample_categories",
    idColumn: "id",
    access: {
      ...PUBLIC_READ,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
  sampleImage: {
    service: () => import("@/domains/sampleImage/services/server/sampleImageService").then((m) => m.sampleImageService),
    table: "sample_images",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: "none",
        import: "none",
      },
    },
  },
  sampleTag: {
    service: () => import("@/domains/sampleTag/services/server/sampleTagService").then((m) => m.sampleTagService),
    table: "sample_tags",
    idColumn: "id",
    access: {
      ...PUBLIC_READ,
      operations: {
        truncateAll: ADMIN_RULE,
        export: "none",
        import: "none",
      },
    },
  },
};
