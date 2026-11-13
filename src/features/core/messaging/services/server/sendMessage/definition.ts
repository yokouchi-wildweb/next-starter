// src/features/core/messaging/services/server/sendMessage/definition.ts
//
// 定義を送れる形にする: 生成の一覧の上書きを重ね、属する種類(category)から種別と経路を付け(resolveMessageDefinition)、検査を通す。
// 門 messagingOverrides が開なら、その後に管理画面の文言(message_overrides)を重ねる(D21: 管理画面 > fork の override > 上流)。
// 管理画面の欄が検査を通らない(もう直せない欄・型が違う・使えない {{鍵}}・並びの数が違う)なら、その欄だけコードの値(D28)

import type { z } from "zod";

import {
  UPSTREAM_CHANNEL_FIELDS,
  applyAdminFieldValues,
  resolveMessageDefinition,
  validateMessageDefinition,
  type ChannelFieldSchemas,
  type MessageCategory,
  type MessageChannel,
  type MessageDefinition,
  type MessageEnricher,
  type MessageOverride,
  type MessageRegistry,
  type ResolvedMessageDefinition,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type { MessageAdminOverrideSource } from "./types";

/** 送る口が受ける定義(経路の束は問わない) */
export type AnyMessageDefinition = MessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;
export type AnyResolvedMessageDefinition = ResolvedMessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;

/** 上流の経路の欄 + 経路の受け口の項目の欄(項目が同じ鍵なら項目の欄) */
export function channelFieldSchemas(channels: Readonly<Record<string, MessageChannel>>): ChannelFieldSchemas {
  const fields: ChannelFieldSchemas = { ...UPSTREAM_CHANNEL_FIELDS };
  for (const channel of Object.values(channels)) fields[channel.key] = channel.fields;
  return fields;
}

/** その連絡に当たる enrichers の provides の鍵({{鍵}} で使える) */
export function enricherKeysFor(
  messageKey: string,
  enrichers: Readonly<Record<string, MessageEnricher>>,
): string[] {
  return Object.values(enrichers)
    .filter((enricher) => enricher.messages === "*" || enricher.messages.some((key) => key === messageKey))
    .flatMap((enricher) => Object.keys(enricher.provides.shape as Record<string, unknown>));
}

/** 定義を送れる形にする部品(送る口の deps の一部) */
export type ResolveDefinitionDeps = {
  registry: MessageRegistry;
  channels: Readonly<Record<string, MessageChannel>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  /** categories の受け口(fork の種類の override を重ねた後) */
  categories: Readonly<Record<string, MessageCategory>>;
  adminOverrides?: MessageAdminOverrideSource;
};

/**
 * 上書きを重ね、種類から種別と経路を付けて検査した定義を返す。上書きは生成の一覧(messageRegistry)の項目から読む。
 * adminOverrides があり門が開なら、管理画面の文言を 1 回読んで重ねる(通らない欄はコードの値のまま、警告だけ)。
 * options.category = 送る時に決めた種類(回に残した種類で cron が組み直す・管理の送信の仮の種類)。省略 = 定義の種類
 * @throws DomainError(500) 定義か上書きに誤りがある(呼び手の入力ではなくコードの誤り)
 */
export async function resolveDefinition(
  source: AnyMessageDefinition,
  deps: ResolveDefinitionDeps,
  options: { category?: string } = {},
): Promise<AnyResolvedMessageDefinition> {
  const definition = options.category ? ({ ...source, category: options.category } as AnyMessageDefinition) : source;
  const entry = deps.registry[definition.key];
  const override: MessageOverride<ChannelFieldSchemas> | undefined = entry?.override
    ? (await entry.override()).messageOverride
    : undefined;

  const problems = validateMessageDefinition(definition, {
    categories: deps.categories,
    override,
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(definition.key, deps.enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(
      `連絡の定義に誤りがあります(${definition.key}): ${problems.map((problem) => problem.message).join(" / ")}`,
      { status: 500 },
    );
  }
  const resolved = resolveMessageDefinition(definition, override, deps.categories[definition.category]!);
  const adminOverrides = deps.adminOverrides;
  if (!adminOverrides || !resolved.adminEditable?.length || !adminOverrides.enabled()) return resolved;

  const values = await adminOverrides.load(definition.key);
  if (values.length === 0) return resolved;
  const merged = applyAdminFieldValues(resolved, values, {
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(definition.key, deps.enrichers),
  });
  for (const { fieldPath, problem } of merged.rejected) {
    console.warn(`[messaging] 管理画面の文言を使わずコードの値で送ります(${definition.key} ${fieldPath}): ${problem.message}`);
  }
  return merged.resolved;
}

/**
 * 送る経路を決める: 種類の経路(D86)。requested = その回だけの絞り(管理の手で送る時・テンプレートの版の経路)。
 * 種類の外の経路と空の絞りは拒む(足すことはできない)。中身の無い経路も拒む
 * @throws DomainError(400)
 */
export function resolveChannels(
  resolved: AnyResolvedMessageDefinition,
  requested: readonly string[] | undefined,
  channels: Readonly<Record<string, MessageChannel>>,
): string[] {
  const allowed = [...resolved.channels] as string[];
  if (requested !== undefined) {
    const list = [...new Set(requested)];
    if (list.length === 0) {
      throw new DomainError(`送る経路を 1 つ以上選んでください(${resolved.key})`, { status: 400 });
    }
    const outside = list.filter((key) => !allowed.includes(key));
    if (outside.length > 0) {
      throw new DomainError(
        `経路 ${outside.join(", ")} は種類 ${resolved.category} の経路(${allowed.join(" / ")})に無いので使えません(絞ることだけができます)`,
        { status: 400 },
      );
    }
    return checkContent(resolved, allowed.filter((key) => list.includes(key)), channels);
  }
  return checkContent(resolved, allowed, channels);
}

function checkContent(
  resolved: AnyResolvedMessageDefinition,
  list: string[],
  channels: Readonly<Record<string, MessageChannel>>,
): string[] {
  const content = resolved.content as Record<string, unknown>;
  for (const key of list) {
    const from = channels[key]?.contentFrom?.channel;
    if (content[key] === undefined && !(from && content[from] !== undefined)) {
      throw new DomainError(`経路 ${key} の中身が定義にありません(${resolved.key})`, { status: 400 });
    }
  }
  if (resolved.required && !list.includes("email")) {
    throw new DomainError(`止められない連絡から email は外せません(${resolved.key})`, { status: 400 });
  }
  return list;
}

/**
 * 生成の一覧の全件を確かめる(L2.2。テストと出荷前の検査が呼ぶ):
 * 鍵が合う・上書きを重ね種類を付けた定義が validateMessageDefinition を通る・描き方は EmailView を export している。
 * @returns 誤りの文(空 = 全件よい)
 */
export async function checkMessageRegistry(deps: ResolveDefinitionDeps): Promise<string[]> {
  const { registry } = deps;
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(registry)) {
    try {
      if (entry.key !== key) problems.push(`${key}: 項目の key が ${entry.key}`);
      const { message } = await entry.definition();
      if (!message) {
        problems.push(`${key}: 定義のモジュールに export const message が無い`);
        continue;
      }
      if (message.key !== key) problems.push(`${key}: 定義の鍵が ${message.key}`);
      await resolveDefinition(message, { ...deps, adminOverrides: undefined });
      if (entry.view) {
        const view = await entry.view();
        if (typeof view.EmailView !== "function") problems.push(`${key}: 描き方が EmailView を export していない`);
      }
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return problems;
}
