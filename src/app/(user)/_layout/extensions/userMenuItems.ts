// 生成物・編集不可: pnpm generate extensions が src/app/(user)/_layout/extensionPoints.ts から生成する
// userMenuItems: 差す側の <ドメイン>/plugs/userMenuItems/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const item(並びは項目の order → <差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { UserMenuPlugItem } from "@/app/(user)/_layout/points";

export const userMenuItems: { domain: string | null; name: string; requires: readonly string[]; plug: UserMenuPlugItem }[] = [];
