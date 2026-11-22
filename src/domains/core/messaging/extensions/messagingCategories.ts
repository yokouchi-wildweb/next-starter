// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingCategories: 差す側の <ドメイン>/plugs/messagingCategories/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const category(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の label・adminLabel・description・channels・defaultChannels・group を重ねる)

import type { MessageCategory } from "@/lib/messaging";

import { category as messagingCategories_auth_accountLocked } from "@/domains/core/auth/plugs/messagingCategories/accountLocked";
import { category as messagingCategories_auth_earlyRegistration } from "@/domains/core/auth/plugs/messagingCategories/earlyRegistration";
import { category as messagingCategories_auth_emailChange } from "@/domains/core/auth/plugs/messagingCategories/emailChange";
import { category as messagingCategories_auth_emailVerification } from "@/domains/core/auth/plugs/messagingCategories/emailVerification";
import { category as messagingCategories_auth_passwordReset } from "@/domains/core/auth/plugs/messagingCategories/passwordReset";
import { category as messagingCategories_bankTransferReview_bankTransferCheck } from "@/domains/core/bankTransferReview/plugs/messagingCategories/bankTransferCheck";
import { category as messagingCategories_messaging_announcement } from "@/domains/core/messaging/plugs/messagingCategories/announcement";
import { category as messagingCategories_messaging_operatorDirect } from "@/domains/core/messaging/plugs/messagingCategories/operatorDirect";
import { category as messagingCategories_messaging_promotion } from "@/domains/core/messaging/plugs/messagingCategories/promotion";
import { category as messagingCategories_user_registrationComplete } from "@/domains/core/user/plugs/messagingCategories/registrationComplete";
import { category as messagingCategories_wallet_walletAdjusted } from "@/domains/core/wallet/plugs/messagingCategories/walletAdjusted";
import { category as messagingCategories_wallet_walletExpired } from "@/domains/core/wallet/plugs/messagingCategories/walletExpired";
import { category as messagingCategories_wallet_walletExpiring } from "@/domains/core/wallet/plugs/messagingCategories/walletExpiring";

export const messagingCategories: { domain: string | null; name: string; requires: readonly string[]; plug: MessageCategory }[] = [
  { domain: "auth", name: "accountLocked", requires: [], plug: messagingCategories_auth_accountLocked },
  { domain: "auth", name: "earlyRegistration", requires: [], plug: messagingCategories_auth_earlyRegistration },
  { domain: "auth", name: "emailChange", requires: [], plug: messagingCategories_auth_emailChange },
  { domain: "auth", name: "emailVerification", requires: [], plug: messagingCategories_auth_emailVerification },
  { domain: "auth", name: "passwordReset", requires: [], plug: messagingCategories_auth_passwordReset },
  { domain: "bankTransferReview", name: "bankTransferCheck", requires: [], plug: messagingCategories_bankTransferReview_bankTransferCheck },
  { domain: "messaging", name: "announcement", requires: [], plug: messagingCategories_messaging_announcement },
  { domain: "messaging", name: "operatorDirect", requires: [], plug: messagingCategories_messaging_operatorDirect },
  { domain: "messaging", name: "promotion", requires: [], plug: messagingCategories_messaging_promotion },
  { domain: "user", name: "registrationComplete", requires: [], plug: messagingCategories_user_registrationComplete },
  { domain: "wallet", name: "walletAdjusted", requires: [], plug: messagingCategories_wallet_walletAdjusted },
  { domain: "wallet", name: "walletExpired", requires: [], plug: messagingCategories_wallet_walletExpired },
  { domain: "wallet", name: "walletExpiring", requires: [], plug: messagingCategories_wallet_walletExpiring },
];
