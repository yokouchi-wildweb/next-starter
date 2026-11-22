// 生成物・編集不可: pnpm generate extensions が src/domains/core/milestone/extensionPoints.ts から生成する
// milestoneRenderers: 差す側の <ドメイン>/plugs/milestoneRenderers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const renderer(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MilestoneRendererDefinition } from "@/domains/core/milestone/types/milestoneRenderer";

export const milestoneRenderers: { domain: string | null; name: string; requires: readonly string[]; plug: MilestoneRendererDefinition }[] = [];
