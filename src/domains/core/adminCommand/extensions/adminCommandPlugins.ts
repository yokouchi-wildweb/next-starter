// 生成物・編集不可: pnpm generate extensions が src/domains/core/adminCommand/extensionPoints.ts から生成する
// adminCommandPlugins: 差す側の <ドメイン>/plugs/adminCommandPlugins/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plugin(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { AdminCommandPlugin } from "@/domains/core/adminCommand/base/types";

export const adminCommandPlugins: { domain: string | null; name: string; requires: readonly string[]; load: () => Promise<AdminCommandPlugin> }[] = [];
