// 生成物・編集不可: pnpm extensions:generate が src/features/core/setting/extensionPoints.ts から生成する
// sections: src/features/core/setting/sections/<名前>.ts(x) か <名前>/index.ts(x) の export const section(並びはファイル名の順)

import type { SettingSectionDefinition } from "@/features/core/setting/types/definition";

import { section as sections_general } from "@/features/core/setting/sections/general";
import { section as sections_maintenance } from "@/features/core/setting/sections/maintenance";

const sectionsList: SettingSectionDefinition[] = [
  sections_general,
  sections_maintenance,
];
export const sections: Readonly<Record<string, SettingSectionDefinition>> = Object.assign(Object.create(null), Object.fromEntries(sectionsList.map((item) => [String(item.key), item])));
if (Object.keys(sections).length !== sectionsList.length) throw new Error("sections: key が重複している項目がある");
