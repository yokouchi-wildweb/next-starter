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
  audit_log: auditLogConfig,
  bank_transfer_review: bankTransferReviewConfig,
  batch_job: batchJobConfig,
  chat_room: chatRoomConfig,
  coupon: couponConfig,
  coupon_attribution_reward: couponAttributionRewardConfig,
  coupon_history: couponHistoryConfig,
  coupon_issuer_grant: couponIssuerGrantConfig,
  cron_checkpoint: cronCheckpointConfig,
  device_fingerprint: deviceFingerprintConfig,
  fingerprint_challenge: fingerprintChallengeConfig,
  milestone: milestoneConfig,
  outbox: outboxConfig,
  paired_device: pairedDeviceConfig,
  purchase_quota: purchaseQuotaConfig,
  purchase_request: purchaseRequestConfig,
  rate_limit: rateLimitConfig,
  referral: referralConfig,
  referral_reward: referralRewardConfig,
  setting: settingConfig,
  storage_object: storageObjectConfig,
  task_run: taskRunConfig,
  user: userConfig,
  user_acquisition: userAcquisitionConfig,
  user_counter: userCounterConfig,
  user_group: userGroupConfig,
  user_line_profile: userLineProfileConfig,
  user_login_event: userLoginEventConfig,
  user_tag: userTagConfig,
  user_x_profile: userXProfileConfig,
  wallet: walletConfig,
  wallet_history: walletHistoryConfig,
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_image: sampleImageConfig,
  sample_tag: sampleTagConfig,
} as const;

export type DomainKey = keyof typeof domainConfigMap;

export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;
