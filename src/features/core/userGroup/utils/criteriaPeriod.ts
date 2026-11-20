// src/features/core/userGroup/utils/criteriaPeriod.ts
// 期間の部品(登録の時期・最後のログインの時期)の共通の部分: 引数の zod と、列への述語。
// Date は drizzle の演算子に渡す(raw の sql に JS の Date を埋めない、CLAUDE.md raw_sql)

import { and, gte, isNull, lt, lte, or, type AnyColumn, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { FieldConfig } from "@/lib/formSuite";
import type { InlineFieldGroup } from "@/lib/formSuite";

const DAY_MS = 24 * 60 * 60 * 1000;

const periodShape = {
  /** この時刻以後(ISO 8601) */
  from: z.string().datetime({ offset: true }).optional(),
  /** この時刻以前(ISO 8601) */
  to: z.string().datetime({ offset: true }).optional(),
  /** 評価の時刻から N 日以内 */
  withinDays: z.number().int().min(1).max(3650).optional(),
};

/** 期間の引数(どれか 1 つは要る) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- 足す鍵が無い時の既定(空の形)
export function periodArgs<E extends z.ZodRawShape = {}>(extra: E = {} as E) {
  return z
    .object({ ...periodShape, ...extra })
    .strict()
    .refine((value) => Object.values(value).some((item) => item !== undefined), { message: "期間の項目をいずれか 1 つ入力してください" })
    .refine((value) => !(value.from && value.to) || value.from <= value.to, { message: "開始日時は終了日時より前にしてください" });
}

/** 期間の欄(name = 引数の鍵) */
export const PERIOD_FIELDS: readonly FieldConfig[] = [
  { name: "from", label: "開始日時(この日時以降)", formInput: "datetimeInput" },
  { name: "to", label: "終了日時(この日時以前)", formInput: "datetimeInput" },
  { name: "withinDays", label: "直近 N 日以内", formInput: "numberInput", helperText: "今日から数えて何日以内か" },
];

/** 期間の欄の並べ方(D90): 開始〜終了を 1 行、直近 N 日を短い別の行 */
export const PERIOD_INLINE_GROUPS: readonly InlineFieldGroup[] = [
  { key: "period", label: "期間", fields: ["from", "to"], inputConfigs: [{}, { prefix: "〜" }] },
  { key: "recent", label: "直近", fields: ["withinDays"], fieldWidths: ["w-32"], inputConfigs: [{ suffix: "日以内" }] },
];

/** 列の期間の述語(from 以後・to 以前・now から withinDays 日以内の and) */
export function periodWhere(
  column: AnyColumn,
  args: { from?: string; to?: string; withinDays?: number },
  now: Date,
): SQL[] {
  const conditions: SQL[] = [];
  if (args.from) conditions.push(gte(column, new Date(args.from)));
  if (args.to) conditions.push(lte(column, new Date(args.to)));
  if (args.withinDays !== undefined) conditions.push(gte(column, new Date(now.getTime() - args.withinDays * DAY_MS)));
  return conditions;
}

/** now から N 日以内に無い(列が null = 一度も無いも含む) */
export function notWithinDaysWhere(column: AnyColumn, days: number, now: Date): SQL {
  return or(isNull(column), lt(column, new Date(now.getTime() - days * DAY_MS)))!;
}

export const andAll = (conditions: SQL[]): SQL => and(...conditions)!;
