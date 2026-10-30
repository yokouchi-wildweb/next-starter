// 生成物・編集不可: pnpm extensions:generate が src/features/core/user/extensionPoints.ts から生成する
// reservedNames: src/features/core/user/reservedNames/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const provider(並びはファイル名の順)

import type { ReservedUserNameProvider } from "@/features/core/user/types";

export const reservedNames: ReservedUserNameProvider[] = [];
