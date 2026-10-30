// src/features/core/setting/services/server/read.ts
// 保存値をキーごとに検証して読む純関数。保存値は書き換えない。

import type { SettingFieldDefinition } from "../../types/definition";

/** キーの既定値(override の default が優先) */
export function settingDefaultOf(field: SettingFieldDefinition): unknown {
  return "default" in field ? field.default : field.schema.parse(undefined);
}

/**
 * 保存値を読む。無いキーは既定値、今の定義に合わないキーだけ既定値 + サーバーログの警告
 * @param keys 読むキー(省略 = 全部)
 */
export function readSettingValues(
  stored: Record<string, unknown> | null | undefined,
  definitions: Readonly<Record<string, SettingFieldDefinition>>,
  keys: readonly string[] = Object.keys(definitions),
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const field = definitions[key];
    if (!field) continue;
    if (!stored || !Object.hasOwn(stored, key)) {
      values[key] = settingDefaultOf(field);
      continue;
    }
    const parsed = field.schema.safeParse(stored[key]);
    if (parsed.success) {
      values[key] = parsed.data;
    } else {
      // 値は出さない
      console.warn(`[setting] 保存値がキー "${key}" の定義に合わないので既定値を使います`);
      values[key] = settingDefaultOf(field);
    }
  }
  return values;
}
