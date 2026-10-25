// src/app/api/cron/storage-sweep/task.ts
// ファイル台帳の掃除（期限切れのアップロード・未採用のファイル・削除の再試行・紐付け先の行が消えたファイルの照合）— cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側（storageObject/services/server/sweep.ts）。vercel.json のエントリは pnpm cron:generate がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "storage-sweep",
  description: "ファイル台帳の期限切れ pending・猶予を過ぎた未採用の ready・実物の削除が済んでいない行・紐付け先の行が消えた ready を片付ける",
  schedule: "35 * * * *", // 毎時 35 分（--plan hobby では 1 日 1 回になる）
  run: async () => {
    const { runStorageSweep } = await import("@/features/core/storageObject/services/server/sweep");
    // 照合で台帳の record_type から業務行のサービスを引く口は、登録表を結んだ wiring から渡す（features は登録表を直接引かない）
    const { lookupDomainService } = await import("@/wiring/domains");
    return await runStorageSweep({ lookupService: lookupDomainService });
  },
};
