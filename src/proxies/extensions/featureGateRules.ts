// 生成物・編集不可: pnpm extensions:generate が src/proxies/extensionPoints.ts から生成する
// featureGateRules: src/proxies/featureGateRules/<名前>.ts(x) か <名前>/index.ts(x) の export const rule(並びはファイル名の順)

import type { GatedFeatureRule } from "@/proxies/types";

import { rule as featureGateRules_adminChatRooms } from "@/proxies/featureGateRules/adminChatRooms";
import { rule as featureGateRules_adminDemoUsers } from "@/proxies/featureGateRules/adminDemoUsers";
import { rule as featureGateRules_adminNotificationTemplates } from "@/proxies/featureGateRules/adminNotificationTemplates";
import { rule as featureGateRules_adminTabsDemo } from "@/proxies/featureGateRules/adminTabsDemo";
import { rule as featureGateRules_bankTransferReview } from "@/proxies/featureGateRules/bankTransferReview";
import { rule as featureGateRules_coupon } from "@/proxies/featureGateRules/coupon";
import { rule as featureGateRules_demoLogin } from "@/proxies/featureGateRules/demoLogin";
import { rule as featureGateRules_demoPages } from "@/proxies/featureGateRules/demoPages";
import { rule as featureGateRules_mypageOther } from "@/proxies/featureGateRules/mypageOther";
import { rule as featureGateRules_notificationBroadcast } from "@/proxies/featureGateRules/notificationBroadcast";
import { rule as featureGateRules_pageEntry } from "@/proxies/featureGateRules/pageEntry";
import { rule as featureGateRules_pageMypage } from "@/proxies/featureGateRules/pageMypage";
import { rule as featureGateRules_pageMypageAccount } from "@/proxies/featureGateRules/pageMypageAccount";
import { rule as featureGateRules_pageMypageAccountEmail } from "@/proxies/featureGateRules/pageMypageAccountEmail";
import { rule as featureGateRules_pageMypageAccountPassword } from "@/proxies/featureGateRules/pageMypageAccountPassword";
import { rule as featureGateRules_pageMypageAccountPhone } from "@/proxies/featureGateRules/pageMypageAccountPhone";
import { rule as featureGateRules_pageMypageAccountProfile } from "@/proxies/featureGateRules/pageMypageAccountProfile";
import { rule as featureGateRules_pagePrivacyPolicy } from "@/proxies/featureGateRules/pagePrivacyPolicy";
import { rule as featureGateRules_pageServices } from "@/proxies/featureGateRules/pageServices";
import { rule as featureGateRules_pageTerms } from "@/proxies/featureGateRules/pageTerms";
import { rule as featureGateRules_pageTradelaw } from "@/proxies/featureGateRules/pageTradelaw";
import { rule as featureGateRules_pairedDevice } from "@/proxies/featureGateRules/pairedDevice";
import { rule as featureGateRules_pause } from "@/proxies/featureGateRules/pause";
import { rule as featureGateRules_payment } from "@/proxies/featureGateRules/payment";
import { rule as featureGateRules_referral } from "@/proxies/featureGateRules/referral";
import { rule as featureGateRules_sampleDomain } from "@/proxies/featureGateRules/sampleDomain";
import { rule as featureGateRules_signup } from "@/proxies/featureGateRules/signup";
import { rule as featureGateRules_userTag } from "@/proxies/featureGateRules/userTag";
import { rule as featureGateRules_wallet } from "@/proxies/featureGateRules/wallet";
import { rule as featureGateRules_withdraw } from "@/proxies/featureGateRules/withdraw";

// tables = 規則の features のフォルダから導いた表名(表定義は import しない。proxy が読むのは規則と config だけ)
export const featureGateRules: GatedFeatureRule[] = [
  { ...featureGateRules_adminChatRooms, tables: [] },
  { ...featureGateRules_adminDemoUsers, tables: [] },
  { ...featureGateRules_adminNotificationTemplates, tables: [] },
  { ...featureGateRules_adminTabsDemo, tables: [] },
  { ...featureGateRules_bankTransferReview, tables: [] },
  { ...featureGateRules_coupon, tables: ["coupons", "coupon_histories", "coupon_attribution_rewards", "coupon_issuer_grants"] },
  { ...featureGateRules_demoLogin, tables: [] },
  { ...featureGateRules_demoPages, tables: [] },
  { ...featureGateRules_mypageOther, tables: [] },
  { ...featureGateRules_notificationBroadcast, tables: [] },
  { ...featureGateRules_pageEntry, tables: [] },
  { ...featureGateRules_pageMypage, tables: [] },
  { ...featureGateRules_pageMypageAccount, tables: [] },
  { ...featureGateRules_pageMypageAccountEmail, tables: [] },
  { ...featureGateRules_pageMypageAccountPassword, tables: [] },
  { ...featureGateRules_pageMypageAccountPhone, tables: [] },
  { ...featureGateRules_pageMypageAccountProfile, tables: [] },
  { ...featureGateRules_pagePrivacyPolicy, tables: [] },
  { ...featureGateRules_pageServices, tables: [] },
  { ...featureGateRules_pageTerms, tables: [] },
  { ...featureGateRules_pageTradelaw, tables: [] },
  { ...featureGateRules_pairedDevice, tables: ["paired_devices", "device_pairings"] },
  { ...featureGateRules_pause, tables: [] },
  { ...featureGateRules_payment, tables: ["purchase_requests", "bank_transfer_reviews", "purchase_quota_ledger"] },
  { ...featureGateRules_referral, tables: [] },
  { ...featureGateRules_sampleDomain, tables: ["samples", "sample_to_sample_tag", "sample_categories", "sample_tags", "sample_images"] },
  { ...featureGateRules_signup, tables: [] },
  { ...featureGateRules_userTag, tables: [] },
  { ...featureGateRules_wallet, tables: ["wallets", "wallet_lots", "wallet_histories"] },
  { ...featureGateRules_withdraw, tables: [] },
];
