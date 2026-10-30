// 生成物・編集不可: pnpm registry:generate が src/features/** の pgTable から生成する
// src/registry/schemaRegistry.ts
//
// db:push の唯一のスキーマ入口。pgTable を持つファイルを走査して全部並べる(足し忘れが起きない)。
// 機能を閉じたときに外す表は scripts/registry/schemaGate.ts が別に見る。検査: pnpm registry:check / pnpm test:schema-registry

export * from "@/registry/profileTableRegistry";
export * from "@/features/core/analytics/entities/drizzle";
export * from "@/features/core/auditLog/entities/drizzle";
export * from "@/features/core/bankTransferReview/entities/drizzle";
export * from "@/features/core/batchJob/entities/drizzle";
export * from "@/features/core/coupon/entities/drizzle";
export * from "@/features/core/couponAttributionReward/entities/drizzle";
export * from "@/features/core/couponHistory/entities/drizzle";
export * from "@/features/core/couponIssuerGrant/entities/drizzle";
export * from "@/features/core/cronCheckpoint/entities/drizzle";
export * from "@/features/core/deviceFingerprint/entities/drizzle";
export * from "@/features/core/fingerprintChallenge/entities/drizzle";
export * from "@/features/core/interactionTracking/entities/drizzle";
export * from "@/features/core/messaging/entities/drizzle";
export * from "@/features/core/milestone/entities/drizzle";
export * from "@/features/core/notification/entities/drizzle";
export * from "@/features/core/notification/entities/notificationRead";
export * from "@/features/core/notification/entities/notificationReadState";
export * from "@/features/core/notificationTemplate/entities/drizzle";
export * from "@/features/core/pairedDevice/entities/drizzle";
export * from "@/features/core/purchaseQuota/entities/drizzle";
export * from "@/features/core/purchaseRequest/entities/drizzle";
export * from "@/features/core/rateLimit/entities/drizzle";
export * from "@/features/core/referral/entities/drizzle";
export * from "@/features/core/referralReward/entities/drizzle";
export * from "@/features/core/setting/entities/drizzle";
export * from "@/features/core/storageObject/entities/drizzle";
export * from "@/features/core/user/entities/drizzle";
export * from "@/features/core/userAcquisition/entities/drizzle";
export * from "@/features/core/userCounter/entities/drizzle";
export * from "@/features/core/userLineProfile/entities/drizzle";
export * from "@/features/core/userLoginEvent/entities/drizzle";
export * from "@/features/core/userTag/entities/drizzle";
export * from "@/features/core/userXProfile/entities/drizzle";
export * from "@/features/core/wallet/entities/drizzle";
export * from "@/features/core/walletHistory/entities/drizzle";
export * from "@/features/sample/entities/drizzle";
export * from "@/features/sampleCategory/entities/drizzle";
export * from "@/features/sampleImage/entities/drizzle";
export * from "@/features/sampleTag/entities/drizzle";

export {};
