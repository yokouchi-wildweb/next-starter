// 生成物・編集不可: pnpm generate extensions が src/domains/core/setting/extensionPoints.ts から生成する
// settingSections: 差す側の <ドメイン>/plugs/settingSections/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const section(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の label・order・icon・allowRoles・description・groups を重ねる)

import type { SettingSectionDefinition } from "@/domains/core/setting/types/definition";

import { section as settingSections_setting_general } from "@/domains/core/setting/plugs/settingSections/general";
import { section as settingSections_setting_maintenance } from "@/domains/core/setting/plugs/settingSections/maintenance";

export const settingSections: { domain: string | null; name: string; requires: readonly string[]; plug: SettingSectionDefinition }[] = [
  { domain: "setting", name: "general", requires: [], plug: settingSections_setting_general },
  { domain: "setting", name: "maintenance", requires: [], plug: settingSections_setting_maintenance },
];
