// 生成物・編集不可: pnpm registry:generate が src/features/**/services/server/domainEntry.ts から生成する
// src/registry/serviceRegistry.ts
//
// ドメイン名からサービス・表・主キーを引く正式な仕組み（登録表）。ドメインを 1 つ作ると行が増える一覧で、
// 下流が中身を足す登録口ではない。新しい用途で独自の対応表を作らず、この表を引く（src/wiring/domains.ts の getService 系）。
// - 業務ドメイン: dc:generate が domain.json から domainEntry.ts を生成 → この表に載る
// - core ドメイン・fork が core パスに作るドメイン: domainEntry.ts を手書き
// - fork が core の access を変える: 隣に domainEntry.override.ts（fork 所有、access だけ）
// サービスは遅延読み込み（この表を import しても各ドメインのサービス・DB 接続は読み込まれない）。
// 検査: pnpm registry:check / 詳細: src/lib/domain/README.md

import type { DomainRegistry } from "@/lib/domain/types";

import { domainEntries as auditLogEntries } from "@/features/core/auditLog/services/server/domainEntry";
import { domainEntries as bankTransferReviewEntries } from "@/features/core/bankTransferReview/services/server/domainEntry";
import { domainEntries as chatRoomEntries } from "@/features/core/chatRoom/services/server/domainEntry";
import { domainEntries as couponEntries } from "@/features/core/coupon/services/server/domainEntry";
import { domainEntries as couponAttributionRewardEntries } from "@/features/core/couponAttributionReward/services/server/domainEntry";
import { domainEntries as couponHistoryEntries } from "@/features/core/couponHistory/services/server/domainEntry";
import { domainEntries as couponIssuerGrantEntries } from "@/features/core/couponIssuerGrant/services/server/domainEntry";
import { domainEntries as deviceFingerprintEntries } from "@/features/core/deviceFingerprint/services/server/domainEntry";
import { domainEntries as fingerprintChallengeEntries } from "@/features/core/fingerprintChallenge/services/server/domainEntry";
import { domainEntries as interactionTrackingEntries } from "@/features/core/interactionTracking/services/server/domainEntry";
import { domainEntries as milestoneEntries } from "@/features/core/milestone/services/server/domainEntry";
import { domainEntries as notificationEntries } from "@/features/core/notification/services/server/domainEntry";
import { domainEntries as notificationTemplateEntries } from "@/features/core/notificationTemplate/services/server/domainEntry";
import { domainEntries as pairedDeviceEntries } from "@/features/core/pairedDevice/services/server/domainEntry";
import { domainEntries as purchaseRequestEntries } from "@/features/core/purchaseRequest/services/server/domainEntry";
import { domainEntries as referralEntries } from "@/features/core/referral/services/server/domainEntry";
import { domainEntries as referralRewardEntries } from "@/features/core/referralReward/services/server/domainEntry";
import { domainEntries as settingEntries } from "@/features/core/setting/services/server/domainEntry";
import { domainEntries as userEntries } from "@/features/core/user/services/server/domainEntry";
import { domainEntries as userCounterEntries } from "@/features/core/userCounter/services/server/domainEntry";
import { domainEntries as userLineProfileEntries } from "@/features/core/userLineProfile/services/server/domainEntry";
import { domainEntries as userLoginEventEntries } from "@/features/core/userLoginEvent/services/server/domainEntry";
import { domainEntries as userTagEntries } from "@/features/core/userTag/services/server/domainEntry";
import { domainEntries as userXProfileEntries } from "@/features/core/userXProfile/services/server/domainEntry";
import { domainEntries as walletEntries } from "@/features/core/wallet/services/server/domainEntry";
import { domainEntries as walletHistoryEntries } from "@/features/core/walletHistory/services/server/domainEntry";
import { domainEntries as sampleEntries } from "@/features/sample/services/server/domainEntry";
import { domainEntries as sampleCategoryEntries } from "@/features/sampleCategory/services/server/domainEntry";
import { domainEntries as sampleTagEntries } from "@/features/sampleTag/services/server/domainEntry";

export const serviceRegistry: DomainRegistry = {
  auditLog: auditLogEntries.auditLog,
  auditLogFailed: auditLogEntries.auditLogFailed,
  bankTransferReview: bankTransferReviewEntries.bankTransferReview,
  chatRoom: chatRoomEntries.chatRoom,
  coupon: couponEntries.coupon,
  couponAttributionReward: couponAttributionRewardEntries.couponAttributionReward,
  couponHistory: couponHistoryEntries.couponHistory,
  couponIssuerGrant: couponIssuerGrantEntries.couponIssuerGrant,
  deviceFingerprint: deviceFingerprintEntries.deviceFingerprint,
  fingerprintChallenge: fingerprintChallengeEntries.fingerprintChallenge,
  interactionEvent: interactionTrackingEntries.interactionEvent,
  milestone: milestoneEntries.milestone,
  notification: notificationEntries.notification,
  notificationTemplate: notificationTemplateEntries.notificationTemplate,
  pairedDevice: pairedDeviceEntries.pairedDevice,
  purchaseRequest: purchaseRequestEntries.purchaseRequest,
  referral: referralEntries.referral,
  referralReward: referralRewardEntries.referralReward,
  setting: settingEntries.setting,
  user: userEntries.user,
  userCounter: userCounterEntries.userCounter,
  userLineProfile: userLineProfileEntries.userLineProfile,
  userLoginEvent: userLoginEventEntries.userLoginEvent,
  userTag: userTagEntries.userTag,
  userXProfile: userXProfileEntries.userXProfile,
  wallet: walletEntries.wallet,
  walletHistory: walletHistoryEntries.walletHistory,
  sample: sampleEntries.sample,
  sampleCategory: sampleCategoryEntries.sampleCategory,
  sampleTag: sampleTagEntries.sampleTag,
};
