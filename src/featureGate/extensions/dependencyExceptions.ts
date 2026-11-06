// 生成物・編集不可: pnpm generate extensions が src/featureGate/extensionPoints.ts から生成する
// dependencyExceptions: src/featureGate/dependencyExceptions/<名前>.ts(x) か <名前>/index.ts(x) の export const exception(並びはファイル名の順)

import type { DependencyException } from "@/featureGate";

export const dependencyExceptions: DependencyException[] = [];
