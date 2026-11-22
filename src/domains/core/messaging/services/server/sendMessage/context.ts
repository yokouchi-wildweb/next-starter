// src/domains/core/messaging/services/server/sendMessage/context.ts
//
// 差し込む値(vars ∪ 受信者ごとの値 ∪ enrichers の provides ∪ 共通の文脈)と差し込み。送信チャンネルの中身の組み立ては ./content.ts

import {
  COMMON_CONTEXT_KEYS,
  THROTTLE_CONTEXT_KEYS,
  listSecretVarKeys,
  type MessageEnricher,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import { replaceVariables, type VariableMap } from "@/lib/templateVariables";

import type { AnyResolvedMessageDefinition } from "./definition";
import { enrichersFor } from "./enrichers";
import type { MessageSendDeps, MessageUserRow } from "./types";

/** 受信者ごとの値で上書きできない鍵(共通の文脈・まとめた回数) */
const PROTECTED_KEYS: readonly string[] = [...COMMON_CONTEXT_KEYS, ...THROTTLE_CONTEXT_KEYS];

/**
 * 呼び手の vars を定義の zod で検査する。recordVarKeys = 受信者ごとに記録から埋める鍵(管理の定義の送信の記録の入口だけが渡す)
 * @throws DomainError(400) vars が定義に合わない
 */
export function parseVars(
  resolved: AnyResolvedMessageDefinition,
  vars: Record<string, unknown>,
  recordVarKeys: readonly string[] = [],
): Record<string, unknown> {
  // 受信者ごとに記録から埋める鍵(recordVarKeys)は送信の vars では見ない(受信者ごとに parseRecordVars が見る)
  const schema = recordVarKeys.length > 0 ? resolved.vars.omit(keyMask(resolved, recordVarKeys)) : resolved.vars;
  return parseWith(resolved, schema, vars, "連絡の vars");
}

/**
 * 受信者ごとに記録から埋める値(定義の recordVars の鍵、D195)を定義の zod のその鍵だけで検査する。ほかの鍵は受信者ごとの値の決まり(checkRecipientVars)
 * @throws DomainError(400) 型が合わない・必須の値が無い・上書きできない鍵
 */
export function parseRecordVars(
  resolved: AnyResolvedMessageDefinition,
  recipientVars: Record<string, unknown>,
  recordVarKeys: readonly string[],
): Record<string, unknown> {
  const own: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(recipientVars)) (recordVarKeys.includes(key) ? own : rest)[key] = value;
  checkRecipientVars(resolved, rest);
  const parsed = parseWith(resolved, resolved.vars.pick(keyMask(resolved, recordVarKeys)), own, "記録から埋める vars");
  return { ...rest, ...parsed };
}

/** zod の pick / omit の鍵の印(定義の vars に無い鍵は入れない) */
function keyMask(resolved: AnyResolvedMessageDefinition, keys: readonly string[]): Record<string, true> {
  const shape = resolved.vars.shape as Record<string, unknown>;
  return Object.fromEntries(keys.filter((key) => key in shape).map((key) => [key, true as const]));
}

function parseWith(
  resolved: AnyResolvedMessageDefinition,
  schema: AnyResolvedMessageDefinition["vars"],
  vars: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  const parsed = schema.safeParse(vars);
  if (!parsed.success) {
    // 値そのものはエラーに載せない(秘密の値が混ざりうる)。鍵の場所だけ
    const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new DomainError(`${label} が定義に合いません(${resolved.key}): ${paths.join(", ")}`, { status: 400 });
  }
  return parsed.data as Record<string, unknown>;
}

/**
 * 受信者ごとの値を確かめる(定義の vars の鍵・保護された鍵の上書きは拒む)。
 * @throws DomainError(400)
 */
export function checkRecipientVars(
  resolved: AnyResolvedMessageDefinition,
  recipientVars: Record<string, unknown> | undefined,
): void {
  if (!recipientVars) return;
  const varKeys = Object.keys(resolved.vars.shape as Record<string, unknown>);
  for (const key of Object.keys(recipientVars)) {
    if (PROTECTED_KEYS.includes(key) || varKeys.includes(key)) {
      throw new DomainError(`受信者ごとの値で ${key} は上書きできません(${resolved.key})`, { status: 400 });
    }
  }
}

/** 定義の vars のうち秘密の印を持つ鍵 */
export function secretKeysOf(resolved: AnyResolvedMessageDefinition): string[] {
  return listSecretVarKeys(resolved.vars);
}

/** 当たる enrichers(当て先 = 連絡の鍵・カテゴリー・種別・全部、D127)の値を集める(返値は provides の zod で検査する) */
async function enrich(
  enrichers: Readonly<Record<string, MessageEnricher>>,
  resolved: AnyResolvedMessageDefinition,
  vars: Readonly<Record<string, unknown>>,
  user: MessageUserRow | null,
): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const enricher of enrichersFor(resolved, enrichers)) {
    const raw = await enricher.resolve({
      messageKey: resolved.key,
      recipient: { userId: user?.id ?? null, name: user?.name ?? null, email: user?.email ?? null },
      vars,
    });
    const parsed = enricher.provides.safeParse(raw);
    if (!parsed.success) {
      throw new DomainError(`enricher ${enricher.key} の値が provides に合いません`, { status: 500 });
    }
    Object.assign(values, parsed.data);
  }
  return values;
}

/** 受信者 1 人の差し込む値 */
export async function buildRecipientValues(params: {
  deps: MessageSendDeps;
  resolved: AnyResolvedMessageDefinition;
  vars: Record<string, unknown>;
  recipientVars?: Record<string, unknown>;
  user: MessageUserRow | null;
  address?: string | null;
}): Promise<Record<string, unknown>> {
  const { deps, resolved, vars, recipientVars, user } = params;
  const enriched = await enrich(deps.enrichers, resolved, vars, user);
  const { serviceName, serviceNameShort, appBaseUrl } = deps.context();
  return {
    ...vars,
    ...(recipientVars ?? {}),
    ...enriched,
    recipientName: user?.name ?? "",
    recipientEmail: user?.email ?? "",
    serviceName,
    serviceNameShort,
    appBaseUrl,
    // まとめた回数(throttle のある連絡だけ。普通の送りは 1、間引きがお知らせを置き換える時はその回数で描き直す)
    ...(resolved.throttle ? { collapsedCount: 1 } : {}),
  };
}

/** 差し込みの表(文字列・数・真偽だけ。他の値の {{鍵}} はそのまま残る) */
export function toVariableMap(values: Readonly<Record<string, unknown>>, omit: readonly string[] = []): VariableMap {
  const map: VariableMap = {};
  for (const [key, value] of Object.entries(values)) {
    if (omit.includes(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      map[key] = String(value);
    } else if (value instanceof Date) {
      map[key] = value.toISOString();
    }
  }
  return map;
}

/** 欄の値の中の文字列を全部差し込む(入れ子の object・配列も) */
export function renderValue(value: unknown, map: VariableMap): unknown {
  if (typeof value === "string") return replaceVariables(value, map);
  if (Array.isArray(value)) return value.map((item) => renderValue(item, map));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderValue(item, map)]));
  }
  return value;
}
