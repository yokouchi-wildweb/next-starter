// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// rules: src/featureGate/rules/<名前>.ts(x) か <名前>/index.ts(x) の export const rule(並びはファイル名の順)

import type { GatedFeatureRule } from "@/featureGate";

import { rule as rules_adminChatRooms } from "@/featureGate/rules/adminChatRooms";
import { rule as rules_adminDemoUsers } from "@/featureGate/rules/adminDemoUsers";
import { rule as rules_adminNotificationTemplates } from "@/featureGate/rules/adminNotificationTemplates";
import { rule as rules_analytics } from "@/featureGate/rules/analytics";
import { rule as rules_bankTransferReview } from "@/featureGate/rules/bankTransferReview";
import { rule as rules_chatRoom } from "@/featureGate/rules/chatRoom";
import { rule as rules_coupon } from "@/featureGate/rules/coupon";
import { rule as rules_demoLogin } from "@/featureGate/rules/demoLogin";
import { rule as rules_demoPages } from "@/featureGate/rules/demoPages";
import { rule as rules_deviceFingerprint } from "@/featureGate/rules/deviceFingerprint";
import { rule as rules_fingerprintChallenge } from "@/featureGate/rules/fingerprintChallenge";
import { rule as rules_interactionTracking } from "@/featureGate/rules/interactionTracking";
import { rule as rules_milestone } from "@/featureGate/rules/milestone";
import { rule as rules_mypageOther } from "@/featureGate/rules/mypageOther";
import { rule as rules_notification } from "@/featureGate/rules/notification";
import { rule as rules_notificationBroadcast } from "@/featureGate/rules/notificationBroadcast";
import { rule as rules_notificationTemplate } from "@/featureGate/rules/notificationTemplate";
import { rule as rules_pageEntry } from "@/featureGate/rules/pageEntry";
import { rule as rules_pageMypage } from "@/featureGate/rules/pageMypage";
import { rule as rules_pageMypageAccount } from "@/featureGate/rules/pageMypageAccount";
import { rule as rules_pageMypageAccountEmail } from "@/featureGate/rules/pageMypageAccountEmail";
import { rule as rules_pageMypageAccountPassword } from "@/featureGate/rules/pageMypageAccountPassword";
import { rule as rules_pageMypageAccountPhone } from "@/featureGate/rules/pageMypageAccountPhone";
import { rule as rules_pageMypageAccountProfile } from "@/featureGate/rules/pageMypageAccountProfile";
import { rule as rules_pagePrivacyPolicy } from "@/featureGate/rules/pagePrivacyPolicy";
import { rule as rules_pageServices } from "@/featureGate/rules/pageServices";
import { rule as rules_pageTerms } from "@/featureGate/rules/pageTerms";
import { rule as rules_pageTradelaw } from "@/featureGate/rules/pageTradelaw";
import { rule as rules_pairedDevice } from "@/featureGate/rules/pairedDevice";
import { rule as rules_pause } from "@/featureGate/rules/pause";
import { rule as rules_payment } from "@/featureGate/rules/payment";
import { rule as rules_referral } from "@/featureGate/rules/referral";
import { rule as rules_sampleDomain } from "@/featureGate/rules/sampleDomain";
import { rule as rules_signup } from "@/featureGate/rules/signup";
import { rule as rules_userAcquisition } from "@/featureGate/rules/userAcquisition";
import { rule as rules_userCounter } from "@/featureGate/rules/userCounter";
import { rule as rules_userLineProfile } from "@/featureGate/rules/userLineProfile";
import { rule as rules_userTag } from "@/featureGate/rules/userTag";
import { rule as rules_userXProfile } from "@/featureGate/rules/userXProfile";
import { rule as rules_wallet } from "@/featureGate/rules/wallet";
import { rule as rules_withdraw } from "@/featureGate/rules/withdraw";

export type FeatureName = "adminChatRooms" | "adminDemoUsers" | "adminNotificationTemplates" | "analytics" | "bankTransferReview" | "chatRoom" | "coupon" | "demoLogin" | "demoPages" | "deviceFingerprint" | "fingerprintChallenge" | "interactionTracking" | "milestone" | "mypageOther" | "notification" | "notificationBroadcast" | "notificationTemplate" | "pageEntry" | "pageMypage" | "pageMypageAccount" | "pageMypageAccountEmail" | "pageMypageAccountPassword" | "pageMypageAccountPhone" | "pageMypageAccountProfile" | "pagePrivacyPolicy" | "pageServices" | "pageTerms" | "pageTradelaw" | "pairedDevice" | "pause" | "payment" | "referral" | "sampleDomain" | "signup" | "userAcquisition" | "userCounter" | "userLineProfile" | "userTag" | "userXProfile" | "wallet" | "withdraw";

// name = 規則のファイル名、tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)
export const rules: GatedFeatureRule[] = [
  { ...rules_adminChatRooms, name: "adminChatRooms", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_adminDemoUsers, name: "adminDemoUsers", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_adminNotificationTemplates, name: "adminNotificationTemplates", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_analytics, name: "analytics", tables: ["user_daily_activities", "analytics_daily_rollups"], domainApiPaths: [], settingPaths: [], cronPaths: ["/api/cron/analytics-rollup-daily"], pathPatterns: [...rules_analytics.pathPatterns, "/api/cron/analytics-rollup-daily"] },
  { ...rules_bankTransferReview, name: "bankTransferReview", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_chatRoom, name: "chatRoom", tables: [], domainApiPaths: ["/api/chatRoom"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_chatRoom.pathPatterns, "/api/chatRoom"] },
  { ...rules_coupon, name: "coupon", tables: ["coupons", "coupon_histories", "coupon_attribution_rewards", "coupon_issuer_grants"], domainApiPaths: ["/api/coupon", "/api/couponHistory", "/api/couponAttributionReward", "/api/couponIssuerGrant"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_coupon.pathPatterns, "/api/coupon", "/api/couponHistory", "/api/couponAttributionReward", "/api/couponIssuerGrant"] },
  { ...rules_demoLogin, name: "demoLogin", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_demoPages, name: "demoPages", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_deviceFingerprint, name: "deviceFingerprint", tables: ["device_fingerprints"], domainApiPaths: ["/api/deviceFingerprint"], settingPaths: [], cronPaths: ["/api/cron/device-fingerprint-prune"], pathPatterns: [...rules_deviceFingerprint.pathPatterns, "/api/deviceFingerprint", "/api/cron/device-fingerprint-prune"] },
  { ...rules_fingerprintChallenge, name: "fingerprintChallenge", tables: ["fingerprint_challenges", "fingerprint_challenge_access_events"], domainApiPaths: ["/api/fingerprintChallenge"], settingPaths: [], cronPaths: ["/api/cron/fingerprint-challenge-access-prune"], pathPatterns: [...rules_fingerprintChallenge.pathPatterns, "/api/fingerprintChallenge", "/api/cron/fingerprint-challenge-access-prune"] },
  { ...rules_interactionTracking, name: "interactionTracking", tables: ["interaction_events", "interaction_counters", "interaction_daily_counters"], domainApiPaths: ["/api/interactionEvent"], settingPaths: [], cronPaths: ["/api/cron/interaction-event-prune"], pathPatterns: [...rules_interactionTracking.pathPatterns, "/api/interactionEvent", "/api/cron/interaction-event-prune"] },
  { ...rules_milestone, name: "milestone", tables: ["milestones"], domainApiPaths: ["/api/milestone"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_milestone.pathPatterns, "/api/milestone"] },
  { ...rules_mypageOther, name: "mypageOther", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_notification, name: "notification", tables: ["notifications", "notification_reads", "notification_read_states"], domainApiPaths: ["/api/notification"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_notification.pathPatterns, "/api/notification"] },
  { ...rules_notificationBroadcast, name: "notificationBroadcast", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_notificationTemplate, name: "notificationTemplate", tables: ["notification_templates"], domainApiPaths: ["/api/notificationTemplate"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_notificationTemplate.pathPatterns, "/api/notificationTemplate"] },
  { ...rules_pageEntry, name: "pageEntry", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypage, name: "pageMypage", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypageAccount, name: "pageMypageAccount", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypageAccountEmail, name: "pageMypageAccountEmail", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypageAccountPassword, name: "pageMypageAccountPassword", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypageAccountPhone, name: "pageMypageAccountPhone", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageMypageAccountProfile, name: "pageMypageAccountProfile", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pagePrivacyPolicy, name: "pagePrivacyPolicy", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageServices, name: "pageServices", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageTerms, name: "pageTerms", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pageTradelaw, name: "pageTradelaw", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_pairedDevice, name: "pairedDevice", tables: ["paired_devices", "device_pairings"], domainApiPaths: ["/api/pairedDevice"], settingPaths: [], cronPaths: ["/api/cron/paired-device-pairings-prune"], pathPatterns: [...rules_pairedDevice.pathPatterns, "/api/pairedDevice", "/api/cron/paired-device-pairings-prune"] },
  { ...rules_pause, name: "pause", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_payment, name: "payment", tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"], domainApiPaths: ["/api/purchaseRequest", "/api/bankTransferReview"], settingPaths: [], cronPaths: ["/api/cron/expire-pending-purchases"], pathPatterns: [...rules_payment.pathPatterns, "/api/purchaseRequest", "/api/bankTransferReview", "/api/cron/expire-pending-purchases"] },
  { ...rules_referral, name: "referral", tables: ["referrals", "referral_rewards"], domainApiPaths: ["/api/referral", "/api/referralReward"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_referral.pathPatterns, "/api/referral", "/api/referralReward"] },
  { ...rules_sampleDomain, name: "sampleDomain", tables: ["samples", "sample_to_sample_tag", "sample_categories", "sample_tags", "sample_images"], domainApiPaths: ["/api/sample", "/api/sampleCategory", "/api/sampleTag", "/api/sampleImage"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_sampleDomain.pathPatterns, "/api/sample", "/api/sampleCategory", "/api/sampleTag", "/api/sampleImage"] },
  { ...rules_signup, name: "signup", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_userAcquisition, name: "userAcquisition", tables: ["user_acquisitions", "user_acquisition_touches"], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_userCounter, name: "userCounter", tables: ["user_counters", "user_daily_counters"], domainApiPaths: ["/api/userCounter"], settingPaths: [], cronPaths: ["/api/cron/user-daily-counter-prune"], pathPatterns: [...rules_userCounter.pathPatterns, "/api/userCounter", "/api/cron/user-daily-counter-prune"] },
  { ...rules_userLineProfile, name: "userLineProfile", tables: ["user_line_profiles"], domainApiPaths: ["/api/userLineProfile"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_userLineProfile.pathPatterns, "/api/userLineProfile"] },
  { ...rules_userTag, name: "userTag", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
  { ...rules_userXProfile, name: "userXProfile", tables: ["user_x_profiles"], domainApiPaths: ["/api/userXProfile"], settingPaths: [], cronPaths: [], pathPatterns: [...rules_userXProfile.pathPatterns, "/api/userXProfile"] },
  { ...rules_wallet, name: "wallet", tables: ["wallets", "wallet_lots", "wallet_histories"], domainApiPaths: ["/api/wallet", "/api/walletHistory"], settingPaths: [], cronPaths: ["/api/cron/wallet-expiration-notice", "/api/cron/wallet-expire-lots", "/api/cron/wallet-lots-prune"], pathPatterns: [...rules_wallet.pathPatterns, "/api/wallet", "/api/walletHistory", "/api/cron/wallet-expiration-notice", "/api/cron/wallet-expire-lots", "/api/cron/wallet-lots-prune"] },
  { ...rules_withdraw, name: "withdraw", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [] },
];
