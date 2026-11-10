// src/features/core/messaging/services/server/sendMessage/definition.ts
//
// 定義を送れる形にする: 生成の一覧の上書きを重ね(applyMessageOverride)、検査(validateMessageDefinition)を通す。

import type { z } from "zod";

import {
  UPSTREAM_CHANNEL_FIELDS,
  applyMessageOverride,
  validateMessageDefinition,
  type ChannelFieldSchemas,
  type MessageChannel,
  type MessageDefinition,
  type MessageEnricher,
  type MessageOverride,
  type MessageRegistry,
  type ResolvedMessageDefinition,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

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

/**
 * 上書きを重ねて検査した定義を返す。上書きは生成の一覧(messageRegistry)の項目から読む。
 * @throws DomainError(500) 定義か上書きに誤りがある(呼び手の入力ではなくコードの誤り)
 */
export async function resolveDefinition(
  definition: AnyMessageDefinition,
  registry: MessageRegistry,
  channels: Readonly<Record<string, MessageChannel>>,
  enrichers: Readonly<Record<string, MessageEnricher>>,
): Promise<AnyResolvedMessageDefinition> {
  const entry = registry[definition.key];
  const override: MessageOverride<ChannelFieldSchemas> | undefined = entry?.override
    ? (await entry.override()).messageOverride
    : undefined;

  const problems = validateMessageDefinition(definition, {
    override,
    channels: channelFieldSchemas(channels),
    variableKeys: enricherKeysFor(definition.key, enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(
      `連絡の定義に誤りがあります(${definition.key}): ${problems.map((problem) => problem.message).join(" / ")}`,
      { status: 500 },
    );
  }
  return applyMessageOverride(definition, override);
}

/**
 * 送る経路を決める(省略 = 定義の defaultChannels)。
 * @throws DomainError(400) 中身の無い経路・required の連絡から email を外した
 */
export function resolveChannels(
  resolved: AnyResolvedMessageDefinition,
  requested: readonly string[] | undefined,
  channels: Readonly<Record<string, MessageChannel>>,
): string[] {
  const list = [...new Set(requested ?? resolved.defaultChannels)];
  if (list.length === 0) {
    throw new DomainError(`送る経路がありません(${resolved.key})`, { status: 400 });
  }
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
