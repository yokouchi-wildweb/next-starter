// 生成物・編集不可: pnpm generate extensions が src/domains/core/user/extensionPoints.ts から生成する
// userReservedNames: 差す側の <ドメイン>/plugs/userReservedNames/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const provider(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { ReservedUserNameProvider } from "@/domains/core/user/types";

export const userReservedNames: { domain: string | null; name: string; requires: readonly string[]; plug: ReservedUserNameProvider }[] = [];
