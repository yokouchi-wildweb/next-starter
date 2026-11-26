// 生成物・編集不可: pnpm generate registry が src/domains/**/entities/*/entity.json から生成する
// src/registry/domainConfigRegistry.ts
//
// 全ドメインの主の登録の宣言 entity.json の一覧(キー = フォルダ名の snake_case)。読み手: src/wiring/domainConfig.ts

import "server-only";

import type { DomainConfigOptionals } from "@/lib/domain";

import auditLogConfig from "@/domains/core/auditLog/entities/auditLog/entity.json";
import bankTransferReviewConfig from "@/domains/core/bankTransferReview/entities/bankTransferReview/entity.json";
import batchJobConfig from "@/domains/core/batchJob/entities/batchJob/entity.json";
import chatRoomConfig from "@/domains/core/chatRoom/entities/chatRoom/entity.json";
import couponConfig from "@/domains/core/coupon/entities/coupon/entity.json";
import couponAttributionRewardConfig from "@/domains/core/couponAttributionReward/entities/couponAttributionReward/entity.json";
import couponHistoryConfig from "@/domains/core/couponHistory/entities/couponHistory/entity.json";
import couponIssuerGrantConfig from "@/domains/core/couponIssuerGrant/entities/couponIssuerGrant/entity.json";
import cronCheckpointConfig from "@/domains/core/cronCheckpoint/entities/cronCheckpoint/entity.json";
import deviceFingerprintConfig from "@/domains/core/deviceFingerprint/entities/deviceFingerprint/entity.json";
import fingerprintChallengeConfig from "@/domains/core/fingerprintChallenge/entities/fingerprintChallenge/entity.json";
import milestoneConfig from "@/domains/core/milestone/entities/milestone/entity.json";
import outboxConfig from "@/domains/core/outbox/entities/outbox/entity.json";
import pairedDeviceConfig from "@/domains/core/pairedDevice/entities/pairedDevice/entity.json";
import purchaseQuotaConfig from "@/domains/core/purchaseQuota/entities/purchaseQuota/entity.json";
import purchaseRequestConfig from "@/domains/core/purchaseRequest/entities/purchaseRequest/entity.json";
import rateLimitConfig from "@/domains/core/rateLimit/entities/rateLimit/entity.json";
import referralConfig from "@/domains/core/referral/entities/referral/entity.json";
import referralRewardConfig from "@/domains/core/referralReward/entities/referralReward/entity.json";
import settingConfig from "@/domains/core/setting/entities/setting/entity.json";
import storageObjectConfig from "@/domains/core/storageObject/entities/storageObject/entity.json";
import taskRunConfig from "@/domains/core/taskRun/entities/taskRun/entity.json";
import userConfig from "@/domains/core/user/entities/user/entity.json";
import userAcquisitionConfig from "@/domains/core/userAcquisition/entities/userAcquisition/entity.json";
import userCounterConfig from "@/domains/core/userCounter/entities/userCounter/entity.json";
import userGroupConfig from "@/domains/core/userGroup/entities/userGroup/entity.json";
import userLineProfileConfig from "@/domains/core/userLineProfile/entities/userLineProfile/entity.json";
import userLoginEventConfig from "@/domains/core/userLoginEvent/entities/userLoginEvent/entity.json";
import userTagConfig from "@/domains/core/userTag/entities/userTag/entity.json";
import userXProfileConfig from "@/domains/core/userXProfile/entities/userXProfile/entity.json";
import walletConfig from "@/domains/core/wallet/entities/wallet/entity.json";
import walletHistoryConfig from "@/domains/core/walletHistory/entities/walletHistory/entity.json";
import sampleConfig from "@/domains/sample/entities/sample/entity.json";
import sampleCategoryConfig from "@/domains/sampleCategory/entities/sampleCategory/entity.json";
import sampleImageConfig from "@/domains/sampleImage/entities/sampleImage/entity.json";
import sampleTagConfig from "@/domains/sampleTag/entities/sampleTag/entity.json";

export const domainConfigMap = {
  audit_log: { ...auditLogConfig, singular: "audit_log", label: "監査ログ", fields: [] },
  bank_transfer_review: { ...bankTransferReviewConfig, singular: "bank_transfer_review", label: "振込の確認", fields: [] },
  batch_job: { ...batchJobConfig, singular: "batch_job", label: "バッチ処理", fields: [] },
  chat_room: chatRoomConfig,
  coupon: couponConfig,
  coupon_attribution_reward: { ...couponAttributionRewardConfig, singular: "coupon_attribution_reward", label: "クーポン帰属報酬", fields: [] },
  coupon_history: couponHistoryConfig,
  coupon_issuer_grant: { ...couponIssuerGrantConfig, singular: "coupon_issuer_grant", label: "クーポン発行者プログラム", fields: [] },
  cron_checkpoint: { ...cronCheckpointConfig, singular: "cron_checkpoint", label: "定期処理の進み", fields: [] },
  device_fingerprint: { ...deviceFingerprintConfig, singular: "device_fingerprint", label: "端末の指紋", fields: [] },
  fingerprint_challenge: { ...fingerprintChallengeConfig, singular: "fingerprint_challenge", label: "回答チャレンジ", fields: [] },
  milestone: milestoneConfig,
  outbox: { ...outboxConfig, singular: "outbox", label: "送り箱", fields: [] },
  paired_device: { ...pairedDeviceConfig, singular: "paired_device", label: "登録端末", fields: [] },
  purchase_quota: purchaseQuotaConfig,
  purchase_request: { ...purchaseRequestConfig, singular: "purchase_request", label: "購入", fields: [] },
  rate_limit: rateLimitConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  setting: { ...settingConfig, singular: "setting", label: "設定", fields: [] },
  storage_object: { ...storageObjectConfig, singular: "storage_object", label: "ファイル台帳", fields: [] },
  task_run: { ...taskRunConfig, singular: "task_run", label: "タスクの実行", fields: [] },
  user: userConfig,
  user_acquisition: { ...userAcquisitionConfig, singular: "user_acquisition", label: "流入経路", fields: [] },
  user_counter: { ...userCounterConfig, singular: "user_counter", label: "ユーザーの数え", fields: [] },
  user_group: { ...userGroupConfig, singular: "user_group", label: "ユーザーグループ", fields: [] },
  user_line_profile: userLineProfileConfig,
  user_login_event: { ...userLoginEventConfig, singular: "user_login_event", label: "ログインの記録", fields: [] },
  user_tag: userTagConfig,
  user_x_profile: { ...userXProfileConfig, singular: "user_x_profile", label: "X のプロフィール", fields: [] },
  wallet: { ...walletConfig, singular: "wallet", label: "財布", fields: [] },
  wallet_history: { ...walletHistoryConfig, singular: "wallet_history", label: "財布の履歴", fields: [] },
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_image: sampleImageConfig,
  sample_tag: sampleTagConfig,
} as const;

export type DomainKey = keyof typeof domainConfigMap;

export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;
