// scripts/tasks/analytics-rollup-backfill.ts
// 使い方: pnpm task analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]

import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "analytics-rollup-backfill",
  run: async () => {
    const { backfillRollup } = await import(
      "@/features/core/analytics/services/server/rollup"
    );
    // pnpm は "--" をそのまま渡してくるため除去する
    const args = process.argv.slice(3).filter((arg) => arg !== "--");
    const metricKey = args[0];
    if (!metricKey || metricKey.startsWith("--")) {
      throw new Error(
        "使い方: pnpm task analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]",
      );
    }
    const readFlag = (name: string): string | undefined => {
      const index = args.indexOf(`--${name}`);
      return index >= 0 ? args[index + 1] : undefined;
    };
    return await backfillRollup({
      metricKey,
      from: readFlag("from"),
      to: readFlag("to"),
    });
  },
};
