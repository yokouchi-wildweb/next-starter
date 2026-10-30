// src/features/core/setting/utils/sectionForm.ts
// セクションの一覧の並びと、設定画面のフォームの組み立て(純関数)。

import { z } from "zod";

import type { FieldConfig } from "@/components/Form/Field/types";

import type { SettingFieldDefinition, SettingSectionDefinition } from "../types/definition";

type Fields = Readonly<Record<string, SettingFieldDefinition>>;
type Sections = Readonly<Record<string, SettingSectionDefinition>>;

/** セクションを order 昇順で返す */
export function listSections(sections: Sections): SettingSectionDefinition[] {
  return Object.values(sections).sort((a, b) => a.order - b.order);
}

/**
 * セクションのフォームの部品を作る。欄を持つキーを ui.order 順に並べる。
 * current に無いキー(そのロールに許されていないキー)は欄を出さず送らない。
 */
export function buildSectionForm(sectionKey: string, fields: Fields, current: Readonly<Record<string, unknown>>) {
  const keys = Object.keys(fields)
    .filter((key) => fields[key].ui?.section === sectionKey && Object.hasOwn(current, key))
    .sort((a, b) => (fields[a].ui?.order ?? 0) - (fields[b].ui?.order ?? 0));
  const fieldConfigs = keys.map((key) => ({ ...fields[key].ui?.field, name: key }) as FieldConfig);
  const schema = z.object(Object.fromEntries(keys.map((key) => [key, fields[key].schema])));
  const defaultValues = Object.fromEntries(keys.map((key) => [key, current[key]]));
  return { keys, fieldConfigs, schema, defaultValues };
}
