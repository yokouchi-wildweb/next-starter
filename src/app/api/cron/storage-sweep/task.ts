// src/app/api/cron/storage-sweep/task.ts
// ファイル台帳の掃除（期限切れのアップロード・未採用のファイル・削除の再試行・紐付け先の行が消えた / 値から外れたファイルの照合）— cron タスク定義（実行時刻・有効条件・呼ぶ関数）
// 処理本体はドメイン側（storageObject/services/server/sweep.ts）。vercel.json のエントリは pnpm generate cron がこのファイルから生成する

import type { CronTaskDefinition } from "@/lib/cron";

export const cronTask: CronTaskDefinition = {
  name: "storage-sweep",
  description: "ファイル台帳の期限切れ pending・猶予を過ぎた未採用の ready・実物の削除が済んでいない行・紐付け先の行が消えた ready を片付け、行の値から外れた ready を報告する（valueCheck が detach なら片付ける）",
  schedule: "35 * * * *", // 毎時 35 分（--plan hobby では 1 日 1 回になる）
  run: async () => {
    const { runStorageSweep } = await import("@/features/core/storageObject/services/server/sweep");
    // 照合で台帳の record_type から業務行のサービスを引く口は、登録表を結んだ wiring から渡す（features は登録表を直接引かない）
    const { lookupDomainService } = await import("@/wiring/domainRegistry");
    // 登録表に無い record_type の有無の関数(お知らせの画像 = 回の行があるか)
    const { existingDispatchIds, INBOX_IMAGE_RECORD_TYPE } = await import("@/features/core/messaging/services/server");
    return await runStorageSweep({
      lookupService: lookupDomainService,
      recordResolvers: { [INBOX_IMAGE_RECORD_TYPE]: existingDispatchIds },
    });
  },
};
