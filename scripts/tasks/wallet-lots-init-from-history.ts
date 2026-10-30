// scripts/tasks/wallet-lots-init-from-history.ts
// 導入時1回だけの初期化（定期実行しない。wallet-lots-init の代替でどちらか一方だけ実行する）:
// 付与履歴からロットを復元し、既に期限を過ぎた分を次回スイープの没収対象にする
// 使い方: pnpm task wallet-lots-init-from-history -- (--wallet-type <通貨>[,<通貨>...] | --all) [--dry-run]
//        --dry-run で対象確認 → dry-run なしで実行

import { readWalletLotsInitSelection } from "./_shared/walletLotsSelection";
import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "wallet-lots-init-from-history",
  run: async () => {
    const { initWalletLotsFromHistory } = await import(
      "@/features/core/wallet/services/server/lots/initWalletLotsFromHistory"
    );
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    return await initWalletLotsFromHistory({
      walletTypes: readWalletLotsInitSelection("wallet-lots-init-from-history", args),
      dryRun: args.includes("--dry-run"),
    });
  },
};
