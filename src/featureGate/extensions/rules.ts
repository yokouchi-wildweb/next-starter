// 生成物・編集不可: pnpm extensions:generate が src/featureGate/extensionPoints.ts から生成する
// rules: src/featureGate/rules/<名前>.ts(x) か <名前>/index.ts(x) の export const rule(並びはファイル名の順)

import type { GatedFeatureRule } from "@/featureGate";

import { rule as rules_adminChatRooms } from "@/featureGate/rules/adminChatRooms";
import { rule as rules_adminDemoUsers } from "@/featureGate/rules/adminDemoUsers";
import { rule as rules_adminNotificationTemplates } from "@/featureGate/rules/adminNotificationTemplates";
import { rule as rules_adminTabsDemo } from "@/featureGate/rules/adminTabsDemo";
import { rule as rules_bankTransferReview } from "@/featureGate/rules/bankTransferReview";
import { rule as rules_coupon } from "@/featureGate/rules/coupon";
import { rule as rules_demoLogin } from "@/featureGate/rules/demoLogin";
import { rule as rules_demoPages } from "@/featureGate/rules/demoPages";
import { rule as rules_mypageOther } from "@/featureGate/rules/mypageOther";
import { rule as rules_notificationBroadcast } from "@/featureGate/rules/notificationBroadcast";
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
import { rule as rules_userTag } from "@/featureGate/rules/userTag";
import { rule as rules_wallet } from "@/featureGate/rules/wallet";
import { rule as rules_withdraw } from "@/featureGate/rules/withdraw";

export type FeatureName = "adminChatRooms" | "adminDemoUsers" | "adminNotificationTemplates" | "adminTabsDemo" | "bankTransferReview" | "coupon" | "demoLogin" | "demoPages" | "mypageOther" | "notificationBroadcast" | "pageEntry" | "pageMypage" | "pageMypageAccount" | "pageMypageAccountEmail" | "pageMypageAccountPassword" | "pageMypageAccountPhone" | "pageMypageAccountProfile" | "pagePrivacyPolicy" | "pageServices" | "pageTerms" | "pageTradelaw" | "pairedDevice" | "pause" | "payment" | "referral" | "sampleDomain" | "signup" | "userTag" | "wallet" | "withdraw";

// name = 規則のファイル名、tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)
export const rules: GatedFeatureRule[] = [
  { ...rules_adminChatRooms, name: "adminChatRooms", tables: [] },
  { ...rules_adminDemoUsers, name: "adminDemoUsers", tables: [] },
  { ...rules_adminNotificationTemplates, name: "adminNotificationTemplates", tables: [] },
  { ...rules_adminTabsDemo, name: "adminTabsDemo", tables: [] },
  { ...rules_bankTransferReview, name: "bankTransferReview", tables: [] },
  { ...rules_coupon, name: "coupon", tables: ["coupons", "coupon_histories", "coupon_attribution_rewards", "coupon_issuer_grants"] },
  { ...rules_demoLogin, name: "demoLogin", tables: [] },
  { ...rules_demoPages, name: "demoPages", tables: [] },
  { ...rules_mypageOther, name: "mypageOther", tables: [] },
  { ...rules_notificationBroadcast, name: "notificationBroadcast", tables: [] },
  { ...rules_pageEntry, name: "pageEntry", tables: [] },
  { ...rules_pageMypage, name: "pageMypage", tables: [] },
  { ...rules_pageMypageAccount, name: "pageMypageAccount", tables: [] },
  { ...rules_pageMypageAccountEmail, name: "pageMypageAccountEmail", tables: [] },
  { ...rules_pageMypageAccountPassword, name: "pageMypageAccountPassword", tables: [] },
  { ...rules_pageMypageAccountPhone, name: "pageMypageAccountPhone", tables: [] },
  { ...rules_pageMypageAccountProfile, name: "pageMypageAccountProfile", tables: [] },
  { ...rules_pagePrivacyPolicy, name: "pagePrivacyPolicy", tables: [] },
  { ...rules_pageServices, name: "pageServices", tables: [] },
  { ...rules_pageTerms, name: "pageTerms", tables: [] },
  { ...rules_pageTradelaw, name: "pageTradelaw", tables: [] },
  { ...rules_pairedDevice, name: "pairedDevice", tables: ["paired_devices", "device_pairings"] },
  { ...rules_pause, name: "pause", tables: [] },
  { ...rules_payment, name: "payment", tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"] },
  { ...rules_referral, name: "referral", tables: [] },
  { ...rules_sampleDomain, name: "sampleDomain", tables: ["samples", "sample_to_sample_tag", "sample_categories", "sample_tags", "sample_images"] },
  { ...rules_signup, name: "signup", tables: [] },
  { ...rules_userTag, name: "userTag", tables: [] },
  { ...rules_wallet, name: "wallet", tables: ["wallets", "wallet_lots", "wallet_histories"] },
  { ...rules_withdraw, name: "withdraw", tables: [] },
];
