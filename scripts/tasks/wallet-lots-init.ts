// scripts/tasks/wallet-lots-init.ts
// 導入時1回だけの初期化（定期実行しない。再実行は対象通貨の全ユーザーの失効カウントをリセットするので注意）
// 使い方: pnpm task wallet-lots-init -- --wallet-type <通貨>[,<通貨>...] | --all

import { readWalletLotsInitSelection } from "./_shared/walletLotsSelection";
import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "wallet-lots-init",
  run: async () => {
    const { initWalletLots } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLots"
    );
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    return await initWalletLots({ walletTypes: readWalletLotsInitSelection("wallet-lots-init", args) });
  },
};
