// 生成物・編集不可: pnpm extensions:generate が src/features/core/milestone/extensionPoints.ts から生成する
// renderers: src/features/core/milestone/components/renderers/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const renderer(並びはファイル名の順)

import type { MilestoneRendererDefinition } from "@/features/core/milestone/types/milestoneRenderer";

const renderersList: MilestoneRendererDefinition[] = [];
export const renderers: Readonly<Record<string, MilestoneRendererDefinition>> = Object.assign(Object.create(null), Object.fromEntries(renderersList.map((item) => [String(item.key), item])));
if (Object.keys(renderers).length !== renderersList.length) throw new Error("renderers: key が重複している項目がある");
