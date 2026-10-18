// 旧パス(互換用)。本体は src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts に移動した(2026-10-18、notice 20261018-160000)。
// この再 export は次の checkpoint 以降に削除する。新しいコードはルート内の loader を直接 import する。

import "server-only";

export {
  loadWalletBalanceScreen,
  type WalletBalanceScreenData,
  type WalletBalanceScreenParams,
} from "@/app/(user)/(protected)/wallet/[slug]/_screen/loader";
