// src/app/admin/(protected)/messaging/_screen/loader.ts
// /admin/messaging の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 認可だけ(範囲 admin/(protected)/guard.ts の createLoader、access 管理者カテゴリ)。
// 回の一覧は増え続けるので、部品 AdminDispatchList が hook(カーソルのモード)で取る。
// 開閉は機能の門 messagingDispatches(src/featureGate/rules/messagingDispatches.ts、既定 開)

import "server-only";

import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminMessagingDispatchListScreenData = Record<string, never>;

export const loadAdminMessagingDispatchListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  load: async (): Promise<AdminMessagingDispatchListScreenData> => ({}),
});
