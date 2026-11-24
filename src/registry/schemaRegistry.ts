// 生成物・編集不可: pnpm generate registry が src/domains/** の pgTable から生成する
// src/registry/schemaRegistry.ts
//
// db:push の唯一のスキーマ入口。pgTable を持つファイルを走査して全部並べる(足し忘れが起きない)。
// 機能を閉じたときに外す表は 門番 src/featureGate/node/gatedSchema.ts(@/featureGate/node の gatedSchema)が別に見る。検査: pnpm check registry / pnpm test scripts/structure/registry

export * from "@/domains/core/analytics/entities/drizzle";
export * from "@/domains/core/auditLog/entities/drizzle";
export * from "@/domains/core/bankTransferReview/entities/drizzle";
export * from "@/domains/core/batchJob/entities/drizzle";
export * from "@/domains/core/coupon/entities/drizzle";
export * from "@/domains/core/couponAttributionReward/entities/drizzle";
export * from "@/domains/core/couponHistory/entities/drizzle";
export * from "@/domains/core/couponIssuerGrant/entities/drizzle";
export * from "@/domains/core/cronCheckpoint/entities/drizzle";
export * from "@/domains/core/deviceFingerprint/entities/drizzle";
export * from "@/domains/core/fingerprintChallenge/entities/drizzle";
export * from "@/domains/core/interactionTracking/entities/drizzle";
export * from "@/domains/core/messaging/entities/delivery";
export * from "@/domains/core/messaging/entities/drizzle";
export * from "@/domains/core/messaging/entities/endpoint";
export * from "@/domains/core/messaging/entities/idempotencyKey";
export * from "@/domains/core/messaging/entities/inbox";
export * from "@/domains/core/messaging/entities/override";
export * from "@/domains/core/messaging/entities/preference";
export * from "@/domains/core/messaging/entities/recipient";
export * from "@/domains/core/messaging/entities/subscriber";
export * from "@/domains/core/messaging/entities/template";
export * from "@/domains/core/milestone/entities/drizzle";
export * from "@/domains/core/outbox/entities/drizzle";
export * from "@/domains/core/pairedDevice/entities/drizzle";
export * from "@/domains/core/purchaseQuota/entities/drizzle";
export * from "@/domains/core/purchaseRequest/entities/drizzle";
export * from "@/domains/core/rateLimit/entities/drizzle";
export * from "@/domains/core/referral/entities/drizzle";
export * from "@/domains/core/referralReward/entities/drizzle";
export * from "@/domains/core/setting/entities/drizzle";
export * from "@/domains/core/storageObject/entities/drizzle";
export * from "@/domains/core/taskRun/entities/drizzle";
export * from "@/domains/core/user/entities/drizzle";
export * from "@/domains/core/userAcquisition/entities/drizzle";
export * from "@/domains/core/userCounter/entities/drizzle";
export * from "@/domains/core/userGroup/entities/drizzle";
export * from "@/domains/core/userLineProfile/entities/drizzle";
export * from "@/domains/core/userLoginEvent/entities/drizzle";
export * from "@/domains/core/userProfile/entities/profiles/contributor/drizzle";
export * from "@/domains/core/userTag/entities/drizzle";
export * from "@/domains/core/userXProfile/entities/drizzle";
export * from "@/domains/core/wallet/entities/drizzle";
export * from "@/domains/core/walletHistory/entities/drizzle";
export * from "@/domains/sample/entities/drizzle";
export * from "@/domains/sampleCategory/entities/drizzle";
export * from "@/domains/sampleImage/entities/drizzle";
export * from "@/domains/sampleTag/entities/drizzle";

export {};
