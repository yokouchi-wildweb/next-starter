// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// rules: src/featureGate/rules/<名前>.ts(x) か <名前>/index.ts(x) の export const rule(並びはファイル名の順)

import type { GatedCronTask, GatedDomain, GatedSettingSection, GeneratedFeatureRule } from "@/featureGate";

import { rule as rules_adminDemoUsers } from "@/featureGate/rules/adminDemoUsers";
import { rule as rules_analytics } from "@/featureGate/rules/analytics";
import { rule as rules_bankTransferReview } from "@/featureGate/rules/bankTransferReview";
import { rule as rules_chatRoom } from "@/featureGate/rules/chatRoom";
import { rule as rules_coupon } from "@/featureGate/rules/coupon";
import { rule as rules_couponAttributionReward } from "@/featureGate/rules/couponAttributionReward";
import { rule as rules_demoDeviceFingerprint } from "@/featureGate/rules/demoDeviceFingerprint";
import { rule as rules_demoLogin } from "@/featureGate/rules/demoLogin";
import { rule as rules_demoPages } from "@/featureGate/rules/demoPages";
import { rule as rules_demoPayment } from "@/featureGate/rules/demoPayment";
import { rule as rules_demoSampleDomain } from "@/featureGate/rules/demoSampleDomain";
import { rule as rules_deviceFingerprint } from "@/featureGate/rules/deviceFingerprint";
import { rule as rules_fingerprintChallenge } from "@/featureGate/rules/fingerprintChallenge";
import { rule as rules_interactionTracking } from "@/featureGate/rules/interactionTracking";
import { rule as rules_messagingDispatches } from "@/featureGate/rules/messagingDispatches";
import { rule as rules_messagingInbox } from "@/featureGate/rules/messagingInbox";
import { rule as rules_messagingOverrides } from "@/featureGate/rules/messagingOverrides";
import { rule as rules_messagingPreferences } from "@/featureGate/rules/messagingPreferences";
import { rule as rules_messagingTemplates } from "@/featureGate/rules/messagingTemplates";
import { rule as rules_messagingTracking } from "@/featureGate/rules/messagingTracking";
import { rule as rules_milestone } from "@/featureGate/rules/milestone";
import { rule as rules_mypageInvite } from "@/featureGate/rules/mypageInvite";
import { rule as rules_mypageOther } from "@/featureGate/rules/mypageOther";
import { rule as rules_mypagePause } from "@/featureGate/rules/mypagePause";
import { rule as rules_mypageWithdraw } from "@/featureGate/rules/mypageWithdraw";
import { rule as rules_pageEntry } from "@/featureGate/rules/pageEntry";
import { rule as rules_pageMypage } from "@/featureGate/rules/pageMypage";
import { rule as rules_pagePrivacyPolicy } from "@/featureGate/rules/pagePrivacyPolicy";
import { rule as rules_pageServices } from "@/featureGate/rules/pageServices";
import { rule as rules_pageTerms } from "@/featureGate/rules/pageTerms";
import { rule as rules_pageTradelaw } from "@/featureGate/rules/pageTradelaw";
import { rule as rules_pairedDevice } from "@/featureGate/rules/pairedDevice";
import { rule as rules_pause } from "@/featureGate/rules/pause";
import { rule as rules_payment } from "@/featureGate/rules/payment";
import { rule as rules_paymentAnalytics } from "@/featureGate/rules/paymentAnalytics";
import { rule as rules_phoneVerification } from "@/featureGate/rules/phoneVerification";
import { rule as rules_referral } from "@/featureGate/rules/referral";
import { rule as rules_sampleDomain } from "@/featureGate/rules/sampleDomain";
import { rule as rules_signup } from "@/featureGate/rules/signup";
import { rule as rules_userAcquisition } from "@/featureGate/rules/userAcquisition";
import { rule as rules_userCounter } from "@/featureGate/rules/userCounter";
import { rule as rules_userLineProfile } from "@/featureGate/rules/userLineProfile";
import { rule as rules_userXProfile } from "@/featureGate/rules/userXProfile";
import { rule as rules_wallet } from "@/featureGate/rules/wallet";
import { rule as rules_walletAnalytics } from "@/featureGate/rules/walletAnalytics";
import { rule as rules_withdraw } from "@/featureGate/rules/withdraw";

export type FeatureName = "adminDemoUsers" | "analytics" | "bankTransferReview" | "chatRoom" | "coupon" | "couponAttributionReward" | "demoDeviceFingerprint" | "demoLogin" | "demoPages" | "demoPayment" | "demoSampleDomain" | "deviceFingerprint" | "fingerprintChallenge" | "interactionTracking" | "messagingDispatches" | "messagingInbox" | "messagingOverrides" | "messagingPreferences" | "messagingTemplates" | "messagingTracking" | "milestone" | "mypageInvite" | "mypageOther" | "mypagePause" | "mypageWithdraw" | "pageEntry" | "pageMypage" | "pagePrivacyPolicy" | "pageServices" | "pageTerms" | "pageTradelaw" | "pairedDevice" | "pause" | "payment" | "paymentAnalytics" | "phoneVerification" | "referral" | "sampleDomain" | "signup" | "userAcquisition" | "userCounter" | "userLineProfile" | "userXProfile" | "wallet" | "walletAnalytics" | "withdraw";

// name = 規則のファイル名、tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)
export const rules: GeneratedFeatureRule[] = [
  { ...rules_adminDemoUsers, name: "adminDemoUsers", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["demoLogin"], anyOf: [] },
  { ...rules_analytics, name: "analytics", tables: ["user_daily_activities", "analytics_daily_rollups"], domainApiPaths: [], settingPaths: [], cronPaths: ["/api/cron/analytics-rollup-daily"], dependsOn: [], anyOf: [] },
  { ...rules_bankTransferReview, name: "bankTransferReview", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["payment"], anyOf: [] },
  { ...rules_chatRoom, name: "chatRoom", tables: [], domainApiPaths: ["/api/chatRoom"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_coupon, name: "coupon", tables: ["coupons", "coupon_histories", "coupon_issuer_grants"], domainApiPaths: ["/api/coupon", "/api/couponHistory", "/api/couponIssuerGrant"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_couponAttributionReward, name: "couponAttributionReward", tables: ["coupon_attribution_rewards"], domainApiPaths: ["/api/couponAttributionReward"], settingPaths: [], cronPaths: [], dependsOn: ["wallet"], anyOf: [] },
  { ...rules_demoDeviceFingerprint, name: "demoDeviceFingerprint", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["demoPages", "deviceFingerprint"], anyOf: [] },
  { ...rules_demoLogin, name: "demoLogin", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_demoPages, name: "demoPages", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_demoPayment, name: "demoPayment", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["demoPages", "payment"], anyOf: [] },
  { ...rules_demoSampleDomain, name: "demoSampleDomain", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["demoPages", "sampleDomain"], anyOf: [] },
  { ...rules_deviceFingerprint, name: "deviceFingerprint", tables: ["device_fingerprints"], domainApiPaths: ["/api/deviceFingerprint"], settingPaths: [], cronPaths: ["/api/cron/device-fingerprint-prune"], dependsOn: [], anyOf: [] },
  { ...rules_fingerprintChallenge, name: "fingerprintChallenge", tables: ["fingerprint_challenges", "fingerprint_challenge_access_events"], domainApiPaths: ["/api/fingerprintChallenge"], settingPaths: [], cronPaths: ["/api/cron/fingerprint-challenge-access-prune"], dependsOn: ["deviceFingerprint"], anyOf: [] },
  { ...rules_interactionTracking, name: "interactionTracking", tables: ["interaction_events", "interaction_counters", "interaction_daily_counters"], domainApiPaths: ["/api/interactionEvent"], settingPaths: [], cronPaths: ["/api/cron/interaction-event-prune"], dependsOn: [], anyOf: [] },
  { ...rules_messagingDispatches, name: "messagingDispatches", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_messagingInbox, name: "messagingInbox", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_messagingOverrides, name: "messagingOverrides", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["messagingDispatches"], anyOf: [] },
  { ...rules_messagingPreferences, name: "messagingPreferences", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["pageMypage"], anyOf: [] },
  { ...rules_messagingTemplates, name: "messagingTemplates", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["messagingDispatches"], anyOf: [] },
  { ...rules_messagingTracking, name: "messagingTracking", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_milestone, name: "milestone", tables: ["milestones"], domainApiPaths: ["/api/milestone"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_mypageInvite, name: "mypageInvite", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["pageMypage", "referral"], anyOf: [] },
  { ...rules_mypageOther, name: "mypageOther", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["pageMypage"], anyOf: ["pause", "withdraw"] },
  { ...rules_mypagePause, name: "mypagePause", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["pageMypage", "pause"], anyOf: [] },
  { ...rules_mypageWithdraw, name: "mypageWithdraw", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["pageMypage", "withdraw"], anyOf: [] },
  { ...rules_pageEntry, name: "pageEntry", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pageMypage, name: "pageMypage", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pagePrivacyPolicy, name: "pagePrivacyPolicy", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pageServices, name: "pageServices", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pageTerms, name: "pageTerms", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pageTradelaw, name: "pageTradelaw", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_pairedDevice, name: "pairedDevice", tables: ["paired_devices", "device_pairings"], domainApiPaths: ["/api/pairedDevice"], settingPaths: [], cronPaths: ["/api/cron/paired-device-pairings-prune"], dependsOn: [], anyOf: [] },
  { ...rules_pause, name: "pause", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_payment, name: "payment", tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"], domainApiPaths: ["/api/purchaseRequest", "/api/bankTransferReview"], settingPaths: [], cronPaths: ["/api/cron/expire-pending-purchases"], dependsOn: ["wallet"], anyOf: [] },
  { ...rules_paymentAnalytics, name: "paymentAnalytics", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["analytics", "payment"], anyOf: [] },
  { ...rules_phoneVerification, name: "phoneVerification", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_referral, name: "referral", tables: ["referrals", "referral_rewards"], domainApiPaths: ["/api/referral", "/api/referralReward"], settingPaths: [], cronPaths: [], dependsOn: ["coupon"], anyOf: [] },
  { ...rules_sampleDomain, name: "sampleDomain", tables: ["samples", "sample_to_sample_tag", "sample_categories", "sample_tags", "sample_images"], domainApiPaths: ["/api/sample", "/api/sampleCategory", "/api/sampleTag", "/api/sampleImage"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_signup, name: "signup", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_userAcquisition, name: "userAcquisition", tables: ["user_acquisitions", "user_acquisition_touches"], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_userCounter, name: "userCounter", tables: ["user_counters", "user_daily_counters"], domainApiPaths: ["/api/userCounter"], settingPaths: [], cronPaths: ["/api/cron/user-daily-counter-prune"], dependsOn: [], anyOf: [] },
  { ...rules_userLineProfile, name: "userLineProfile", tables: ["user_line_profiles"], domainApiPaths: ["/api/userLineProfile"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_userXProfile, name: "userXProfile", tables: ["user_x_profiles"], domainApiPaths: ["/api/userXProfile"], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
  { ...rules_wallet, name: "wallet", tables: ["wallets", "wallet_lots", "wallet_histories"], domainApiPaths: ["/api/wallet", "/api/walletHistory"], settingPaths: [], cronPaths: ["/api/cron/wallet-expiration-notice", "/api/cron/wallet-expire-lots", "/api/cron/wallet-lots-prune"], dependsOn: [], anyOf: [] },
  { ...rules_walletAnalytics, name: "walletAnalytics", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: ["analytics", "wallet"], anyOf: [] },
  { ...rules_withdraw, name: "withdraw", tables: [], domainApiPaths: [], settingPaths: [], cronPaths: [], dependsOn: [], anyOf: [] },
];

// domains = どれかの規則の features に載るドメイン(開 = 持つ機能 features のどれかが開。載らないドメインは常に開)、apiPaths = 汎用 API の住所
export const domains: GatedDomain[] = [
  { folder: "core/analytics", tables: ["user_daily_activities", "analytics_daily_rollups"], apiPaths: [], features: ["analytics"] },
  { folder: "core/bankTransferReview", tables: ["bank_transfer_reviews"], apiPaths: ["/api/bankTransferReview"], features: ["payment"] },
  { folder: "core/chatRoom", tables: [], apiPaths: ["/api/chatRoom"], features: ["chatRoom"] },
  { folder: "core/coupon", tables: ["coupons"], apiPaths: ["/api/coupon"], features: ["coupon"] },
  { folder: "core/couponAttributionReward", tables: ["coupon_attribution_rewards"], apiPaths: ["/api/couponAttributionReward"], features: ["couponAttributionReward"] },
  { folder: "core/couponHistory", tables: ["coupon_histories"], apiPaths: ["/api/couponHistory"], features: ["coupon"] },
  { folder: "core/couponIssuerGrant", tables: ["coupon_issuer_grants"], apiPaths: ["/api/couponIssuerGrant"], features: ["coupon"] },
  { folder: "core/deviceFingerprint", tables: ["device_fingerprints"], apiPaths: ["/api/deviceFingerprint"], features: ["deviceFingerprint"] },
  { folder: "core/fingerprintChallenge", tables: ["fingerprint_challenges", "fingerprint_challenge_access_events"], apiPaths: ["/api/fingerprintChallenge"], features: ["fingerprintChallenge"] },
  { folder: "core/interactionTracking", tables: ["interaction_events", "interaction_counters", "interaction_daily_counters"], apiPaths: ["/api/interactionEvent"], features: ["interactionTracking"] },
  { folder: "core/milestone", tables: ["milestones"], apiPaths: ["/api/milestone"], features: ["milestone"] },
  { folder: "core/pairedDevice", tables: ["paired_devices", "device_pairings"], apiPaths: ["/api/pairedDevice"], features: ["pairedDevice"] },
  { folder: "core/phoneVerification", tables: [], apiPaths: [], features: ["phoneVerification"] },
  { folder: "core/purchaseQuota", tables: ["purchase_quota_ledger"], apiPaths: [], features: ["payment"] },
  { folder: "core/purchaseRequest", tables: ["purchase_requests"], apiPaths: ["/api/purchaseRequest"], features: ["payment"] },
  { folder: "core/referral", tables: ["referrals"], apiPaths: ["/api/referral"], features: ["referral"] },
  { folder: "core/referralReward", tables: ["referral_rewards"], apiPaths: ["/api/referralReward"], features: ["referral"] },
  { folder: "core/userAcquisition", tables: ["user_acquisitions", "user_acquisition_touches"], apiPaths: [], features: ["userAcquisition"] },
  { folder: "core/userCounter", tables: ["user_counters", "user_daily_counters"], apiPaths: ["/api/userCounter"], features: ["userCounter"] },
  { folder: "core/userLineProfile", tables: ["user_line_profiles"], apiPaths: ["/api/userLineProfile"], features: ["userLineProfile"] },
  { folder: "core/userXProfile", tables: ["user_x_profiles"], apiPaths: ["/api/userXProfile"], features: ["userXProfile"] },
  { folder: "core/wallet", tables: ["wallets", "wallet_lots"], apiPaths: ["/api/wallet"], features: ["wallet"] },
  { folder: "core/walletHistory", tables: ["wallet_histories"], apiPaths: ["/api/walletHistory"], features: ["wallet"] },
  { folder: "sample", tables: ["samples", "sample_to_sample_tag"], apiPaths: ["/api/sample"], features: ["sampleDomain"] },
  { folder: "sampleCategory", tables: ["sample_categories"], apiPaths: ["/api/sampleCategory"], features: ["sampleDomain"] },
  { folder: "sampleImage", tables: ["sample_images"], apiPaths: ["/api/sampleImage"], features: ["sampleDomain"] },
  { folder: "sampleTag", tables: ["sample_tags"], apiPaths: ["/api/sampleTag"], features: ["sampleDomain"] },
];

// cronTasks = domains のドメインを値で import する cron の task(開 = 読むドメイン folders が全部開。載らない task は常に開)
export const cronTasks: GatedCronTask[] = [
  { path: "/api/cron/analytics-rollup-daily", folders: ["core/analytics"] },
  { path: "/api/cron/device-fingerprint-prune", folders: ["core/deviceFingerprint"] },
  { path: "/api/cron/expire-pending-purchases", folders: ["core/purchaseRequest"] },
  { path: "/api/cron/fingerprint-challenge-access-prune", folders: ["core/fingerprintChallenge"] },
  { path: "/api/cron/interaction-event-prune", folders: ["core/interactionTracking"] },
  { path: "/api/cron/paired-device-pairings-prune", folders: ["core/pairedDevice"] },
  { path: "/api/cron/user-daily-counter-prune", folders: ["core/userCounter"] },
  { path: "/api/cron/wallet-expiration-notice", folders: ["core/wallet"] },
  { path: "/api/cron/wallet-expire-lots", folders: ["core/wallet"] },
  { path: "/api/cron/wallet-lots-prune", folders: ["core/wallet"] },
];

// settingSections = 機能を名指す設定の節(開 = 名指す機能 features が全部開。名指さない節は常に開)
export const settingSections: GatedSettingSection[] = [];
