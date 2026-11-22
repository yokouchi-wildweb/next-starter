// src/domains/core/setting/definitions.ts
// 設定のキーとセクションの定義の表(点 settingFields・settingSections の一覧から作る。項目は差す側の <ドメイン>/plugs/settingFields・settingSections/)。
// キーの定義は「保存された値がどのキーか」を知る表なので門番で絞らない(生成された登録表と同じ扱い、D26)。どのキーも全体で一意(生成器が止める)
// 節は設定の画面が使う物なので、閉じたドメインの節は門番で外す(注文 26 の答え、D22): openSections(gate.plugs | useGate().plugs)

import { settingFields, type SettingFieldsMap } from "./extensions/settingFields";
import { settingSections } from "./extensions/settingSections";
import type { PlugsFilter } from "@/featureGate/client";

import type { SettingSectionDefinition } from "./types/definition";

/** 全キーの定義(キー = 項目の名前。型は生成物の SettingFieldsMap) */
export const fields = Object.assign(Object.create(null), Object.fromEntries(settingFields.map((entry) => [entry.name, entry.plug]))) as SettingFieldsMap;

/** 全セクション(key → 定義)。門番で絞らない: ロールごとに許すキーの表(settingKeysFor)は全キーの定義 fields と同じ扱い */
export const allSections: Readonly<Record<string, SettingSectionDefinition>> = Object.assign(Object.create(null), Object.fromEntries(settingSections.map((entry) => [entry.plug.key, entry.plug])));

/** 設定画面のセクション(key → 定義)。閉じたドメインの節は外す(server は gate.plugs、client は useGate().plugs を渡す) */
export function openSections(plugs: PlugsFilter): Readonly<Record<string, SettingSectionDefinition>> {
  return Object.assign(Object.create(null), Object.fromEntries(plugs(settingSections).map((entry) => [entry.plug.key, entry.plug])));
}
