// 生成物・編集不可: pnpm generate extensions が src/domains/core/user/extensionPoints.ts から生成する
// userCleanupHandlers: 差す側の <ドメイン>/plugs/userCleanupHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const handler(並びは<差す側>/<名前> の順、常に読む: gate.plugs を掛けず項目の enabled で閉じる)

import type { UserCleanupItem } from "@/domains/core/user/services/server/cleanup";

import { handler as userCleanupHandlers_messaging_messagingEndpoints } from "@/domains/core/messaging/plugs/userCleanupHandlers/messagingEndpoints";
import { handler as userCleanupHandlers_messaging_messagingPreferences } from "@/domains/core/messaging/plugs/userCleanupHandlers/messagingPreferences";
import { handler as userCleanupHandlers_purchaseRequest_purchaseRequest } from "@/domains/core/purchaseRequest/plugs/userCleanupHandlers/purchaseRequest";
import { handler as userCleanupHandlers_wallet_wallet } from "@/domains/core/wallet/plugs/userCleanupHandlers/wallet";

export const userCleanupHandlers: { domain: string | null; name: string; requires: readonly string[]; plug: UserCleanupItem }[] = [
  { domain: "messaging", name: "messagingEndpoints", requires: [], plug: userCleanupHandlers_messaging_messagingEndpoints },
  { domain: "messaging", name: "messagingPreferences", requires: [], plug: userCleanupHandlers_messaging_messagingPreferences },
  { domain: "purchaseRequest", name: "purchaseRequest", requires: ["wallet", "walletHistory"], plug: userCleanupHandlers_purchaseRequest_purchaseRequest },
  { domain: "wallet", name: "wallet", requires: [], plug: userCleanupHandlers_wallet_wallet },
];
