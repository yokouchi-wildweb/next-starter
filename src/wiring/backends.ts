// 生成物・編集不可: pnpm generate extensions が src/lib/backends/extensionPoints.ts から生成する
// backendCapabilities: 差す側の <ドメイン>/plugs/backendCapabilities/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const capabilities(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { BackendCapabilityItem } from "@/lib/backends/points";

export const backendCapabilities: { domain: string | null; name: string; requires: readonly string[]; plug: BackendCapabilityItem }[] = [];
