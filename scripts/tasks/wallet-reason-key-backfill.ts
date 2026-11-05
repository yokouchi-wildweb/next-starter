// scripts/tasks/wallet-reason-key-backfill.ts
// 過去の wallet_histories の行に、上流の書き手の分の付与の種類(reason_key)を埋める(定期実行しない。冪等なので再実行は安全)。
// fork の施策の分は fork が 1 回きりの task(scripts/tasks/<名前>.ts)で backfillWalletReasonKeys に自分の規則を渡す(済んだら消してよい)。
// 使い方: pnpm task wallet-reason-key-backfill -- --dry-run で件数を確認 → dry-run なしで実行(締切で止まったら再実行で続きから)
// 詳細: src/features/core/wallet/README.md「付与の種類」

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "wallet-reason-key-backfill",
  run: async () => {
    const { backfillWalletReasonKeys, UPSTREAM_REASON_KEY_BACKFILL_RULES } = await import(
      "@/features/core/walletHistory/services/server/reasonKeyBackfill"
    );
    const args = process.argv.slice(3);
    return await backfillWalletReasonKeys(UPSTREAM_REASON_KEY_BACKFILL_RULES, { dryRun: args.includes("--dry-run") });
  },
};
