// 生成物・編集不可: pnpm generate extensions が src/domains/core/user/extensionPoints.ts から生成する
// reservedNames: src/domains/core/user/reservedNames/<名前>.ts(x) か <名前>/index.ts(x) の export const provider(並びはファイル名の順)

import type { ReservedUserNameProvider } from "@/domains/core/user/types";

export const reservedNames: ReservedUserNameProvider[] = [];
