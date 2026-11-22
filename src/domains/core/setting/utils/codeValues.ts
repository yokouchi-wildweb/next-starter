// src/domains/core/setting/utils/codeValues.ts
// コードで持つキー(config の codeValues)を検証して読める形にする純関数。
// 読み手: settingService(読みに重ねる・DB を読まない判定)・save.ts(保存を断る)・設定画面の loader(欄を読み取り専用にする)

import type { SettingFieldDefinition } from "../types/definition";

/**
 * codeValues をキーの定義(Zod)で検証して返す(書かない部分はキーの既定値で埋まる)。
 * 定義に無いキー・定義に合わない値は止める(コードの書き間違いを読み込みで知らせる。値は出さない)
 */
export function resolveCodeValues(
  codeValues: Readonly<Record<string, unknown>>,
  definitions: Readonly<Record<string, SettingFieldDefinition>>,
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(codeValues)) {
    if (value === undefined) continue;
    const field = definitions[key];
    if (!field) throw new Error(`setting の config: codeValues のキー "${key}" は設定のキーにありません`);
    const parsed = field.schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`setting の config: codeValues の "${key}" がキーの定義に合いません(${parsed.error.errors[0]?.message ?? "invalid"})`);
    }
    values[key] = parsed.data;
  }
  return Object.freeze(values);
}
