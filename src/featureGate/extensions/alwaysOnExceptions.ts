// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// alwaysOnExceptions: src/featureGate/alwaysOnExceptions/<名前>.ts(x) か <名前>/index.ts(x) の export const exception(並びはファイル名の順)

import type { AlwaysOnException } from "@/featureGate";

export const alwaysOnExceptions: AlwaysOnException[] = [];
