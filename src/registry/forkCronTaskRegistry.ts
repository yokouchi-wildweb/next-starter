// src/registry/forkCronTaskRegistry.ts
// fork 独自の定期タスク。upstream は空で出荷し、以後このファイルの中身を編集しない
// （src/styles/custom/** と同じ扱い。fork が自由に書き換える）。
//
// ここに足したタスクは upstream のタスク（src/registry/cronTaskRegistry.ts の CORE_CRON_TASKS）と同じ扱いになる:
// - dispatcher（/api/cron/dispatch/<cadence>）が cadence に従って起動する。vercel.json の編集は不要
// - `pnpm task <name>` で CLI から実行できる（`pnpm task --list` に description が出る）
// - 個別ルート src/app/api/cron/<name>/route.ts が必須（1 行。無いと pnpm test:cron-wiring が失敗する）:
//     export const GET = createCronTaskRoute(getCronTask("<name>"));
//   重い処理は同じファイルで `export const maxDuration = 300;` を足す
//
// タスクの説明は description に書く（fork 独自タスクの文書の置き場はここ）。
// 運用手順など長い説明が要るなら、そのタスクの本体があるディレクトリの README に書いて description から参照する。
//
// 例:
//   export const FORK_CRON_TASKS: CronTaskDefinition[] = [
//     {
//       name: "guest-room-prune",
//       description: "48 時間操作の無いゲストルームを削除する。詳細: src/features/room/README.md",
//       cadence: "daily",
//       run: async () => {
//         const { pruneGuestRooms } = await import("@/features/room/services/server/pruning");
//         return await pruneGuestRooms();
//       },
//     },
//   ];
//
// 詳細: src/lib/cron/README.md

import type { CronTaskDefinition } from "@/lib/cron/types";

export const FORK_CRON_TASKS: CronTaskDefinition[] = [];
