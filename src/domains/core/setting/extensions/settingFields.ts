// 生成物・編集不可: pnpm generate extensions が src/domains/core/setting/extensionPoints.ts から生成する
// settingFields: 差す側の <ドメイン>/plugs/settingFields/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const field(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の ui・public・default・allowRoles を重ねる)

import type { SettingFieldDefinition } from "@/domains/core/setting/types/definition";

import { field as settingFields_setting_adminListPerPage } from "@/domains/core/setting/plugs/settingFields/adminListPerPage";
import { field as settingFields_setting_maintenance } from "@/domains/core/setting/plugs/settingFields/maintenance";

const settingFieldsMap = {
  adminListPerPage: settingFields_setting_adminListPerPage,
  maintenance: settingFields_setting_maintenance,
} as const satisfies Readonly<Record<string, SettingFieldDefinition>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type SettingFieldsMap = typeof settingFieldsMap;
export const settingFields: { domain: string | null; name: string; requires: readonly string[]; plug: SettingFieldDefinition }[] = [
  { domain: "setting", name: "adminListPerPage", requires: [], plug: settingFieldsMap.adminListPerPage },
  { domain: "setting", name: "maintenance", requires: [], plug: settingFieldsMap.maintenance },
];
