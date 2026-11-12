// src/features/core/messaging/services/server/sendMessage/context.ts
//
// 差し込む値(vars ∪ 受信者ごとの値 ∪ enrichers の provides ∪ 共通の文脈)と、経路の中身の描画。

import {
  COMMON_CONTEXT_KEYS,
  THROTTLE_CONTEXT_KEYS,
  listSecretVarKeys,
  type MessageChannel,
  type MessageEnricher,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import { replaceVariables, type VariableMap } from "@/lib/structuredDocument/shared";

import type { AnyResolvedMessageDefinition } from "./definition";
import type { MessageSendDeps, MessageUserRow } from "./types";

/** 受信者ごとの値で上書きできない鍵(共通の文脈・まとめた回数) */
const PROTECTED_KEYS: readonly string[] = [...COMMON_CONTEXT_KEYS, ...THROTTLE_CONTEXT_KEYS];

/**
 * 呼び手の vars を定義の zod で検査する。
 * @throws DomainError(400) vars が定義に合わない
 */
export function parseVars(
  resolved: AnyResolvedMessageDefinition,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = resolved.vars.safeParse(vars);
  if (!parsed.success) {
    // 値そのものはエラーに載せない(秘密の値が混ざりうる)。鍵の場所だけ
    const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new DomainError(`連絡の vars が定義に合いません(${resolved.key}): ${paths.join(", ")}`, { status: 400 });
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

/** 当たる enrichers の値を集める(返値は provides の zod で検査する) */
async function enrich(
  enrichers: Readonly<Record<string, MessageEnricher>>,
  resolved: AnyResolvedMessageDefinition,
  vars: Readonly<Record<string, unknown>>,
  user: MessageUserRow | null,
): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  for (const enricher of Object.values(enrichers)) {
    if (enricher.messages !== "*" && !enricher.messages.includes(resolved.key)) continue;
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
  const { serviceName, appBaseUrl } = deps.context();
  return {
    ...vars,
    ...(recipientVars ?? {}),
    ...enriched,
    recipientName: user?.name ?? "",
    recipientEmail: user?.email ?? "",
    serviceName,
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

/** 経路の中身(定義の content.<経路>、無ければ経路の contentFrom で他の経路の欄から作る) */
export function channelContent(
  resolved: AnyResolvedMessageDefinition,
  channelKey: string,
  channel: MessageChannel | undefined,
): Record<string, unknown> {
  const content = resolved.content as Record<string, Record<string, unknown> | undefined>;
  const own = content[channelKey];
  if (own) return own;
  const from = channel?.contentFrom;
  const source = from ? content[from.channel] : undefined;
  if (!from || !source) return {};
  return Object.fromEntries(Object.entries(from.map).map(([target, field]) => [target, source[field]]));
}

/** 経路の件名・題(subject → title の順で最初の文字列の欄) */
export function headingOf(content: Readonly<Record<string, unknown>>): string | null {
  for (const field of ["subject", "title"]) {
    const value = content[field];
    if (typeof value === "string") return value;
  }
  return null;
}
