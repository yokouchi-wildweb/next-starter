// src/domains/core/wallet/plugs/expiryRules/walletLotsPrune.ts
// 増設点 expiryRules の項目: 消費し尽くしたロット(wallet_lots の remaining = 0)を、作ってから保持日数(walletConfig.lotPruneRetentionDays)が過ぎたら消す
// 消す行: remaining = 0 かつ created_at < 今 − lotPruneRetentionDays 日(有効期限を使う通貨が 1 つも無ければ何も消さない)
// - where: 有効期限を有効にした通貨が 1 つでもあれば通貨を問わず remaining = 0 の古いロット全部、無ければ何も消さない
//   (walletConfig はコードの設定 = 配備時に固定。読み込み時に作っても実行時に読むのと同じ値。上流の項目は enabled を書かない)

import { sql } from "drizzle-orm";

import type { ExpiryRule } from "@/lib/cron/points";
import { walletConfig } from "@/domains/wallet/config";
import { getExpirationEnabledWalletTypes } from "@/domains/core/wallet/utils/expiration";

export const rule: ExpiryRule = {
  table: "wallet_lots",
  key: "id",
  rule: { kind: "age", column: "created_at", days: () => walletConfig.lotPruneRetentionDays },
  where: getExpirationEnabledWalletTypes().length > 0 ? sql`remaining = 0` : sql`false`,
  pii: false,
};
