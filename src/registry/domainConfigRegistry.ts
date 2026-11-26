// 生成物・編集不可: pnpm generate registry が src/domains/**/entities/*/entity.json から生成する
// src/registry/domainConfigRegistry.ts
//
// 全ての登録の宣言 entity.json の一覧(キー = 登録名の snake_case。汎用の単位 = 登録 1 件、D348)。読み手: src/wiring/domainConfig.ts

import "server-only";

import type { DomainConfigOptionals } from "@/lib/domain";

import analyticsDailyRollupConfig from "@/domains/core/analytics/entities/analyticsDailyRollup/entity.json";
import userDailyActivityConfig from "@/domains/core/analytics/entities/userDailyActivity/entity.json";
import auditLogConfig from "@/domains/core/auditLog/entities/auditLog/entity.json";
import auditLogFailedConfig from "@/domains/core/auditLog/entities/auditLogFailed/entity.json";
import bankTransferReviewConfig from "@/domains/core/bankTransferReview/entities/bankTransferReview/entity.json";
import batchJobConfig from "@/domains/core/batchJob/entities/batchJob/entity.json";
import batchJobItemConfig from "@/domains/core/batchJob/entities/batchJobItem/entity.json";
import chatRoomConfig from "@/domains/core/chatRoom/entities/chatRoom/entity.json";
import couponConfig from "@/domains/core/coupon/entities/coupon/entity.json";
import couponAttributionRewardConfig from "@/domains/core/couponAttributionReward/entities/couponAttributionReward/entity.json";
import couponHistoryConfig from "@/domains/core/couponHistory/entities/couponHistory/entity.json";
import couponIssuerGrantConfig from "@/domains/core/couponIssuerGrant/entities/couponIssuerGrant/entity.json";
import cronCheckpointConfig from "@/domains/core/cronCheckpoint/entities/cronCheckpoint/entity.json";
import deviceFingerprintConfig from "@/domains/core/deviceFingerprint/entities/deviceFingerprint/entity.json";
import fingerprintChallengeConfig from "@/domains/core/fingerprintChallenge/entities/fingerprintChallenge/entity.json";
import fingerprintChallengeAccessEventConfig from "@/domains/core/fingerprintChallenge/entities/fingerprintChallengeAccessEvent/entity.json";
import interactionCounterConfig from "@/domains/core/interactionTracking/entities/interactionCounter/entity.json";
import interactionDailyCounterConfig from "@/domains/core/interactionTracking/entities/interactionDailyCounter/entity.json";
import interactionEventConfig from "@/domains/core/interactionTracking/entities/interactionEvent/entity.json";
import messageDeliveryConfig from "@/domains/core/messaging/entities/messageDelivery/entity.json";
import messageDispatchConfig from "@/domains/core/messaging/entities/messageDispatch/entity.json";
import messageDispatchRecipientConfig from "@/domains/core/messaging/entities/messageDispatchRecipient/entity.json";
import messageEndpointConfig from "@/domains/core/messaging/entities/messageEndpoint/entity.json";
import messageEventConfig from "@/domains/core/messaging/entities/messageEvent/entity.json";
import messageIdempotencyKeyConfig from "@/domains/core/messaging/entities/messageIdempotencyKey/entity.json";
import messageInboxItemConfig from "@/domains/core/messaging/entities/messageInboxItem/entity.json";
import messageInboxReadConfig from "@/domains/core/messaging/entities/messageInboxRead/entity.json";
import messageInboxReadStateConfig from "@/domains/core/messaging/entities/messageInboxReadState/entity.json";
import messageOverrideConfig from "@/domains/core/messaging/entities/messageOverride/entity.json";
import messagePreferenceConfig from "@/domains/core/messaging/entities/messagePreference/entity.json";
import messageSubscriberCursorConfig from "@/domains/core/messaging/entities/messageSubscriberCursor/entity.json";
import messageSubscriberFailureConfig from "@/domains/core/messaging/entities/messageSubscriberFailure/entity.json";
import messageSuppressionConfig from "@/domains/core/messaging/entities/messageSuppression/entity.json";
import messageTemplateConfig from "@/domains/core/messaging/entities/messageTemplate/entity.json";
import messageTemplateVersionConfig from "@/domains/core/messaging/entities/messageTemplateVersion/entity.json";
import milestoneConfig from "@/domains/core/milestone/entities/milestone/entity.json";
import outboxConfig from "@/domains/core/outbox/entities/outbox/entity.json";
import devicePairingConfig from "@/domains/core/pairedDevice/entities/devicePairing/entity.json";
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
import userStatusHistoryConfig from "@/domains/core/user/entities/userStatusHistory/entity.json";
import userToUserTagConfig from "@/domains/core/user/entities/userToUserTag/entity.json";
import userAcquisitionConfig from "@/domains/core/userAcquisition/entities/userAcquisition/entity.json";
import userAcquisitionTouchConfig from "@/domains/core/userAcquisition/entities/userAcquisitionTouch/entity.json";
import userCounterConfig from "@/domains/core/userCounter/entities/userCounter/entity.json";
import userDailyCounterConfig from "@/domains/core/userCounter/entities/userDailyCounter/entity.json";
import userGroupConfig from "@/domains/core/userGroup/entities/userGroup/entity.json";
import userGroupDefinitionConfig from "@/domains/core/userGroup/entities/userGroupDefinition/entity.json";
import userGroupMemberConfig from "@/domains/core/userGroup/entities/userGroupMember/entity.json";
import userGroupVersionConfig from "@/domains/core/userGroup/entities/userGroupVersion/entity.json";
import userGroupVersionMemberConfig from "@/domains/core/userGroup/entities/userGroupVersionMember/entity.json";
import userLineProfileConfig from "@/domains/core/userLineProfile/entities/userLineProfile/entity.json";
import userLoginEventConfig from "@/domains/core/userLoginEvent/entities/userLoginEvent/entity.json";
import userTagConfig from "@/domains/core/userTag/entities/userTag/entity.json";
import userXProfileConfig from "@/domains/core/userXProfile/entities/userXProfile/entity.json";
import walletConfig from "@/domains/core/wallet/entities/wallet/entity.json";
import walletLotConfig from "@/domains/core/wallet/entities/walletLot/entity.json";
import walletHistoryConfig from "@/domains/core/walletHistory/entities/walletHistory/entity.json";
import sampleConfig from "@/domains/sample/entities/sample/entity.json";
import sampleImageConfig from "@/domains/sample/entities/sampleImage/entity.json";
import sampleCategoryConfig from "@/domains/sampleCategory/entities/sampleCategory/entity.json";
import sampleTagConfig from "@/domains/sampleTag/entities/sampleTag/entity.json";

export const domainConfigMap = {
  analytics_daily_rollup: { ...analyticsDailyRollupConfig, singular: "analytics_daily_rollup", label: "analyticsDailyRollup", fields: [] },
  user_daily_activity: { ...userDailyActivityConfig, singular: "user_daily_activity", label: "userDailyActivity", fields: [] },
  audit_log: { ...auditLogConfig, singular: "audit_log", label: "監査ログ", fields: [] },
  audit_log_failed: { ...auditLogFailedConfig, singular: "audit_log_failed", label: "auditLogFailed", fields: [] },
  bank_transfer_review: { ...bankTransferReviewConfig, singular: "bank_transfer_review", label: "振込の確認", fields: [] },
  batch_job: { ...batchJobConfig, singular: "batch_job", label: "バッチ処理", fields: [] },
  batch_job_item: { ...batchJobItemConfig, singular: "batch_job_item", label: "batchJobItem", fields: [] },
  chat_room: chatRoomConfig,
  coupon: couponConfig,
  coupon_attribution_reward: { ...couponAttributionRewardConfig, singular: "coupon_attribution_reward", label: "クーポン帰属報酬", fields: [] },
  coupon_history: couponHistoryConfig,
  coupon_issuer_grant: { ...couponIssuerGrantConfig, singular: "coupon_issuer_grant", label: "クーポン発行者プログラム", fields: [] },
  cron_checkpoint: { ...cronCheckpointConfig, singular: "cron_checkpoint", label: "定期処理の進み", fields: [] },
  device_fingerprint: { ...deviceFingerprintConfig, singular: "device_fingerprint", label: "端末の指紋", fields: [] },
  fingerprint_challenge: { ...fingerprintChallengeConfig, singular: "fingerprint_challenge", label: "回答チャレンジ", fields: [] },
  fingerprint_challenge_access_event: { ...fingerprintChallengeAccessEventConfig, singular: "fingerprint_challenge_access_event", label: "fingerprintChallengeAccessEvent", fields: [] },
  interaction_counter: { ...interactionCounterConfig, singular: "interaction_counter", label: "interactionCounter", fields: [] },
  interaction_daily_counter: { ...interactionDailyCounterConfig, singular: "interaction_daily_counter", label: "interactionDailyCounter", fields: [] },
  interaction_event: { ...interactionEventConfig, singular: "interaction_event", label: "interactionEvent", fields: [] },
  message_delivery: { ...messageDeliveryConfig, singular: "message_delivery", label: "messageDelivery", fields: [] },
  message_dispatch: { ...messageDispatchConfig, singular: "message_dispatch", label: "messageDispatch", fields: [] },
  message_dispatch_recipient: { ...messageDispatchRecipientConfig, singular: "message_dispatch_recipient", label: "messageDispatchRecipient", fields: [] },
  message_endpoint: { ...messageEndpointConfig, singular: "message_endpoint", label: "messageEndpoint", fields: [] },
  message_event: { ...messageEventConfig, singular: "message_event", label: "messageEvent", fields: [] },
  message_idempotency_key: { ...messageIdempotencyKeyConfig, singular: "message_idempotency_key", label: "messageIdempotencyKey", fields: [] },
  message_inbox_item: { ...messageInboxItemConfig, singular: "message_inbox_item", label: "messageInboxItem", fields: [] },
  message_inbox_read: { ...messageInboxReadConfig, singular: "message_inbox_read", label: "messageInboxRead", fields: [] },
  message_inbox_read_state: { ...messageInboxReadStateConfig, singular: "message_inbox_read_state", label: "messageInboxReadState", fields: [] },
  message_override: { ...messageOverrideConfig, singular: "message_override", label: "messageOverride", fields: [] },
  message_preference: { ...messagePreferenceConfig, singular: "message_preference", label: "messagePreference", fields: [] },
  message_subscriber_cursor: { ...messageSubscriberCursorConfig, singular: "message_subscriber_cursor", label: "messageSubscriberCursor", fields: [] },
  message_subscriber_failure: { ...messageSubscriberFailureConfig, singular: "message_subscriber_failure", label: "messageSubscriberFailure", fields: [] },
  message_suppression: { ...messageSuppressionConfig, singular: "message_suppression", label: "messageSuppression", fields: [] },
  message_template: { ...messageTemplateConfig, singular: "message_template", label: "messageTemplate", fields: [] },
  message_template_version: { ...messageTemplateVersionConfig, singular: "message_template_version", label: "messageTemplateVersion", fields: [] },
  milestone: milestoneConfig,
  outbox: { ...outboxConfig, singular: "outbox", label: "送り箱", fields: [] },
  device_pairing: { ...devicePairingConfig, singular: "device_pairing", label: "devicePairing", fields: [] },
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
  user_status_history: { ...userStatusHistoryConfig, singular: "user_status_history", label: "userStatusHistory", fields: [] },
  user_to_user_tag: { ...userToUserTagConfig, singular: "user_to_user_tag", label: "userToUserTag", fields: [] },
  user_acquisition: { ...userAcquisitionConfig, singular: "user_acquisition", label: "流入経路", fields: [] },
  user_acquisition_touch: { ...userAcquisitionTouchConfig, singular: "user_acquisition_touch", label: "userAcquisitionTouch", fields: [] },
  user_counter: { ...userCounterConfig, singular: "user_counter", label: "ユーザーの数え", fields: [] },
  user_daily_counter: { ...userDailyCounterConfig, singular: "user_daily_counter", label: "userDailyCounter", fields: [] },
  user_group: { ...userGroupConfig, singular: "user_group", label: "ユーザーグループ", fields: [] },
  user_group_definition: { ...userGroupDefinitionConfig, singular: "user_group_definition", label: "userGroupDefinition", fields: [] },
  user_group_member: { ...userGroupMemberConfig, singular: "user_group_member", label: "userGroupMember", fields: [] },
  user_group_version: { ...userGroupVersionConfig, singular: "user_group_version", label: "userGroupVersion", fields: [] },
  user_group_version_member: { ...userGroupVersionMemberConfig, singular: "user_group_version_member", label: "userGroupVersionMember", fields: [] },
  user_line_profile: userLineProfileConfig,
  user_login_event: { ...userLoginEventConfig, singular: "user_login_event", label: "ログインの記録", fields: [] },
  user_tag: userTagConfig,
  user_x_profile: { ...userXProfileConfig, singular: "user_x_profile", label: "X のプロフィール", fields: [] },
  wallet: { ...walletConfig, singular: "wallet", label: "財布", fields: [] },
  wallet_lot: { ...walletLotConfig, singular: "wallet_lot", label: "walletLot", fields: [] },
  wallet_history: { ...walletHistoryConfig, singular: "wallet_history", label: "財布の履歴", fields: [] },
  sample: sampleConfig,
  sample_image: sampleImageConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
} as const;

export type DomainKey = keyof typeof domainConfigMap;

export type DomainConfig = (typeof domainConfigMap)[DomainKey] & DomainConfigOptionals;
