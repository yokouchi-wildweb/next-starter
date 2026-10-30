// src/features/core/setting/services/server/access.ts
// キーごとの権限の解決(純関数)。キーの allowRoles → 所属セクションの allowRoles → どちらも無ければ管理カテゴリ全員。

import type { SettingFieldDefinition, SettingSectionDefinition } from "../../types/definition";

type Fields = Readonly<Record<string, SettingFieldDefinition>>;
type Sections = Readonly<Record<string, SettingSectionDefinition>>;

/** そのロールに許されたキー(呼び手が管理カテゴリに限っている前提) */
export function settingKeysFor(role: string, fields: Fields, sections: Sections): string[] {
  return Object.keys(fields).filter((key) => {
    const field = fields[key];
    const roles = field.allowRoles ?? (field.ui ? sections[field.ui.section]?.allowRoles : undefined);
    return !roles || (roles as readonly string[]).includes(role);
  });
}

/** 公開してよいキー(public: true だけ) */
export function publicSettingKeys(fields: Fields): string[] {
  return Object.keys(fields).filter((key) => fields[key].public === true);
}
