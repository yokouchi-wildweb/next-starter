// 生成物・編集不可: pnpm generate extensions が src/domains/core/milestone/extensionPoints.ts から生成する
// renderers: src/domains/core/milestone/components/renderers/<名前>.ts(x) か <名前>/index.ts(x) の export const renderer(並びはファイル名の順)

import type { MilestoneRendererDefinition } from "@/domains/core/milestone/types/milestoneRenderer";

const renderersList: MilestoneRendererDefinition[] = [];
export const renderers: Readonly<Record<string, MilestoneRendererDefinition>> = Object.assign(Object.create(null), Object.fromEntries(renderersList.map((item) => [String(item.key), item])));
if (Object.keys(renderers).length !== renderersList.length) throw new Error("renderers: key が重複している項目がある");
