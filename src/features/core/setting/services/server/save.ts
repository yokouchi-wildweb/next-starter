// src/features/core/setting/services/server/save.ts
// 設定の唯一の書き手。送ったキーだけを検証して jsonb に重ね、同じ 1 本の文で一覧に無いキーを取り除く。

import { sql, type SQL } from "drizzle-orm";

import { USER_UPDATE_VALIDATION } from "@/config/app/user-update.config";
import { userFacingValidationMessage } from "@/features/core/user/services/server/helpers/validationMessage";
import { db } from "@/lib/drizzle";
import type { TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors";

import { settingTable } from "../../entities/drizzle";
import { fields } from "../../extensions/fields";
import type { SettingFieldDefinition } from "../../types/definition";

/** 送った値を検証して保存の形にする。一覧に無いキーは 400、undefined は送っていない扱い */
export function validateSettingInput(
  input: Record<string, unknown>,
  definitions: Readonly<Record<string, SettingFieldDefinition>>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const field = definitions[key];
    if (!field) throw new DomainError(`設定キー "${key}" はありません`, { status: 400 });
    const parsed = field.schema.safeParse(value);
    if (!parsed.success) {
      throw new DomainError(userFacingValidationMessage(parsed.error.errors[0], USER_UPDATE_VALIDATION.fallbackMessage), { status: 400 });
    }
    values[key] = parsed.data;
  }
  return values;
}

/** 今の値に送った値を重ね、一覧のキーだけに絞る式(残りが 0 なら '{}') */
export function mergedExtendedSql(values: Record<string, unknown>, keys: readonly string[]): SQL {
  const incoming = JSON.stringify(values);
  const allowed = sql.join(keys.map((key) => sql`${key}`), sql`, `);
  return sql`COALESCE((
    SELECT jsonb_object_agg(entry.key, entry.value)
    FROM jsonb_each(COALESCE(${settingTable.extended}, '{}'::jsonb) || ${incoming}::jsonb) AS entry
    WHERE entry.key IN (${allowed})
  ), '{}'::jsonb)`;
}

/** 保存する(行が無ければ作る)。読み手のメモの破棄は呼び手(settingService) */
export async function saveSettingValues(input: Record<string, unknown>, tx?: TransactionClient): Promise<void> {
  const values = validateSettingInput(input, fields);
  const client = tx ?? db;
  await client
    .insert(settingTable)
    .values({ id: "global", extended: values })
    .onConflictDoUpdate({
      target: settingTable.id,
      set: { extended: mergedExtendedSql(values, Object.keys(fields)), updatedAt: new Date() },
    });
}
