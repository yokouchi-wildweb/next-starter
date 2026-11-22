// src/config/domains/wallet.config.ts
// ウォレットの設定の上書き(持ち主 src/domains/core/wallet/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値を変える: `export default { purchaseRestriction: "phoneVerified", expiration: { regular_coin: { expirationDays: 180, sweepEnabled: true } } } satisfies WalletOverride<Extra>;`
// 通貨を足す: 下の Extra に `currency: { <walletType>: CurrencyConfig }` を足し、値を書く(WalletType に入る。DB のマイグレーションが要る)
import type { WalletOverride } from "@/domains/wallet/config";

export type Extra = Record<never, never>;

export default {} satisfies WalletOverride<Extra>;
