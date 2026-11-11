// src/app/admin/(protected)/messaging/[id]/_screen/loader.ts
// /admin/messaging/[id] の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 認可(access 管理者カテゴリ)と回の id を渡すだけ。回・配達・続きを送るは部品 AdminDispatchDetail が hook で行う
// (配達は増え続けるのでカーソル、回は「続きを送る」の後に取り直す)

import "server-only";

import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminMessagingDispatchScreenParams = { id: string };

export type AdminMessagingDispatchScreenData = { dispatchId: string };

export const loadAdminMessagingDispatchScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<AdminMessagingDispatchScreenParams>): Promise<[string]> => {
    const { id } = await props.params;
    return [id];
  },
  load: async (_ctx, id): Promise<AdminMessagingDispatchScreenData> => ({ dispatchId: id }),
});
