// 生成物・編集不可: pnpm extensions:generate が src/proxies/extensionPoints.ts から生成する
// featureGateRules: src/proxies/featureGateRules/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const rule(並びはファイル名の順)

import type { GatedFeatureRule } from "@/proxies/types";

import { rule as adminChatRooms } from "@/proxies/featureGateRules/adminChatRooms";
import { rule as adminDemoUsers } from "@/proxies/featureGateRules/adminDemoUsers";
import { rule as adminNotificationTemplates } from "@/proxies/featureGateRules/adminNotificationTemplates";
import { rule as adminTabsDemo } from "@/proxies/featureGateRules/adminTabsDemo";
import { rule as bankTransferReview } from "@/proxies/featureGateRules/bankTransferReview";
import { rule as coupon } from "@/proxies/featureGateRules/coupon";
import { rule as demoLogin } from "@/proxies/featureGateRules/demoLogin";
import { rule as demoPages } from "@/proxies/featureGateRules/demoPages";
import { rule as mypageOther } from "@/proxies/featureGateRules/mypageOther";
import { rule as notificationBroadcast } from "@/proxies/featureGateRules/notificationBroadcast";
import { rule as pageEntry } from "@/proxies/featureGateRules/pageEntry";
import { rule as pageMypage } from "@/proxies/featureGateRules/pageMypage";
import { rule as pageMypageAccount } from "@/proxies/featureGateRules/pageMypageAccount";
import { rule as pageMypageAccountEmail } from "@/proxies/featureGateRules/pageMypageAccountEmail";
import { rule as pageMypageAccountPassword } from "@/proxies/featureGateRules/pageMypageAccountPassword";
import { rule as pageMypageAccountPhone } from "@/proxies/featureGateRules/pageMypageAccountPhone";
import { rule as pageMypageAccountProfile } from "@/proxies/featureGateRules/pageMypageAccountProfile";
import { rule as pagePrivacyPolicy } from "@/proxies/featureGateRules/pagePrivacyPolicy";
import { rule as pageServices } from "@/proxies/featureGateRules/pageServices";
import { rule as pageTerms } from "@/proxies/featureGateRules/pageTerms";
import { rule as pageTradelaw } from "@/proxies/featureGateRules/pageTradelaw";
import { rule as pairedDevice } from "@/proxies/featureGateRules/pairedDevice";
import { rule as pause } from "@/proxies/featureGateRules/pause";
import { rule as payment } from "@/proxies/featureGateRules/payment";
import { rule as referral } from "@/proxies/featureGateRules/referral";
import { rule as sampleDomain } from "@/proxies/featureGateRules/sampleDomain";
import { rule as signup } from "@/proxies/featureGateRules/signup";
import { rule as userTag } from "@/proxies/featureGateRules/userTag";
import { rule as wallet } from "@/proxies/featureGateRules/wallet";
import { rule as withdraw } from "@/proxies/featureGateRules/withdraw";

// tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)
export const featureGateRules: GatedFeatureRule[] = [
  { ...adminChatRooms, tables: [] },
  { ...adminDemoUsers, tables: [] },
  { ...adminNotificationTemplates, tables: [] },
  { ...adminTabsDemo, tables: [] },
  { ...bankTransferReview, tables: [] },
  { ...coupon, tables: ["coupons", "coupon_histories", "coupon_attribution_rewards", "coupon_issuer_grants"] },
  { ...demoLogin, tables: [] },
  { ...demoPages, tables: [] },
  { ...mypageOther, tables: [] },
  { ...notificationBroadcast, tables: [] },
  { ...pageEntry, tables: [] },
  { ...pageMypage, tables: [] },
  { ...pageMypageAccount, tables: [] },
  { ...pageMypageAccountEmail, tables: [] },
  { ...pageMypageAccountPassword, tables: [] },
  { ...pageMypageAccountPhone, tables: [] },
  { ...pageMypageAccountProfile, tables: [] },
  { ...pagePrivacyPolicy, tables: [] },
  { ...pageServices, tables: [] },
  { ...pageTerms, tables: [] },
  { ...pageTradelaw, tables: [] },
  { ...pairedDevice, tables: ["paired_devices", "device_pairings"] },
  { ...pause, tables: [] },
  { ...payment, tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"] },
  { ...referral, tables: [] },
  { ...sampleDomain, tables: ["samples", "sample_to_sample_tag", "sample_categories", "sample_tags", "sample_images"] },
  { ...signup, tables: [] },
  { ...userTag, tables: [] },
  { ...wallet, tables: ["wallets", "wallet_lots", "wallet_histories"] },
  { ...withdraw, tables: [] },
];
