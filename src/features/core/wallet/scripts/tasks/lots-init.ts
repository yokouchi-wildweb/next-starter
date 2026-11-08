// src/features/core/wallet/scripts/tasks/lots-init.ts
// 導入時1回だけの初期化（定期実行しない。再実行は対象通貨の全ユーザーの失効カウントをリセットするので注意）
// 使い方: pnpm task wallet:lots-init -- --wallet-type <通貨>[,<通貨>...] | --all

import { readWalletLotsInitSelection, walletLotsStopKeys } from "./lib.walletLotsSelection";
import type { OneShotTask } from "@/lib/task";

export const task: OneShotTask = {
  name: "wallet:lots-init",
  // 一度成功(または結果不明)した通貨は二度と自動では作り直さない(代わりの 1 本と同じ鍵)
  stopKeys: (args) => walletLotsStopKeys("wallet:lots-init", args),
  run: async () => {
    const { initWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLots"
    );
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    return await initWalletLots({ walletTypes: readWalletLotsInitSelection("wallet:lots-init", args) });
  },
};
