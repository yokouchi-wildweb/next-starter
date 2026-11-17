// src/features/core/messaging/services/server/sendMessage/definition.ts
//
// 定義を送れる形にする: 生成の一覧の上書きを重ね、属する種類(category)から種別と経路を付け(resolveMessageDefinition)、検査を通す
// (ひな形が受け口にある・欄の中身がひな形の欄の zod を通る・{{鍵}} が宣言済み)。
// 管理画面の文言(message_overrides)は今は重ねない: 上書きの鍵が『経路.欄』のままで、定義はひな形 + 欄の中身になったため。
// TODO(指令 56): 上書きの鍵を ひな形の欄の鍵へ替え、送る時に重ね直す(D21: 管理画面 > fork の override > 上流)

import type { z } from "zod";

import {
  UPSTREAM_CHANNEL_FIELDS,
  enricherTargets,
  resolveMessageDefinition,
  validateMessageDefinition,
  type ChannelFieldSchemas,
  type MessageCategory,
  type MessageChannel,
  type MessageDefinition,
  type MessageEnricher,
  type MessageKind,
  type MessageLayout,
  type MessageOverride,
  type MessageRegistry,
  type ResolvedMessageDefinition,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { buildContents, type MessageContentDeps } from "./content";

/** 送る口が受ける定義(経路の束は問わない) */
export type AnyMessageDefinition = MessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;
export type AnyResolvedMessageDefinition = ResolvedMessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;

/** 上流の経路の欄 + 経路の受け口の項目の欄(項目が同じ鍵なら項目の欄) */
export function channelFieldSchemas(channels: Readonly<Record<string, MessageChannel>>): ChannelFieldSchemas {
  const fields: ChannelFieldSchemas = { ...UPSTREAM_CHANNEL_FIELDS };
  for (const channel of Object.values(channels)) fields[channel.key] = channel.fields;
  return fields;
}

/** その連絡(鍵・種類・種別)に当たる enrichers(当て先 D127) */
export function enrichersFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageEnricher[] {
  return Object.values(enrichers).filter((enricher) => enricherTargets(enricher.target, message));
}

/** その連絡に当たる enrichers の provides の鍵({{鍵}} で使える) */
export function enricherKeysFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): string[] {
  return enrichersFor(message, enrichers).flatMap((enricher) => Object.keys(enricher.provides.shape as Record<string, unknown>));
}

/** 定義を送れる形にする部品(送る口の deps の一部) */
export type ResolveDefinitionDeps = {
  registry: MessageRegistry;
  channels: Readonly<Record<string, MessageChannel>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  /** categories の受け口(fork の種類の override を重ねた後) */
  categories: Readonly<Record<string, MessageCategory>>;
  /** ひな形の受け口(server の一覧 layouts) */
  layouts: Readonly<Record<string, MessageLayout>>;
};

/**
 * 上書きを重ね、種類から種別と経路を付けて検査した定義を返す。上書きは生成の一覧(messageRegistry)の項目から読む。
 * 管理画面の文言は重ねない(TODO 指令 56、上の説明)。
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
    layouts: deps.layouts,
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(
      { key: definition.key, category: definition.category, kind: deps.categories[definition.category]?.kind ?? "transactional" },
      deps.enrichers,
    ),
  });
  if (problems.length > 0) {
    throw new DomainError(
      `連絡の定義に誤りがあります(${definition.key}): ${problems.map((problem) => problem.message).join(" / ")}`,
      { status: 500 },
    );
  }
  return resolveMessageDefinition(definition, override, deps.categories[definition.category]!);
}

/**
 * 送る経路を決める: 種類の経路(D86)。requested = その回だけの絞り(管理の手で送る時・テンプレートの版の経路)。
 * 種類の外の経路と空の絞りは拒む(足すことはできない)。止められない連絡から email は外せない。
 * 描けない経路は組み立て(sendMessage/content.ts)が回を書く前に止める
 * @throws DomainError(400)
 */
export function resolveChannels(
  resolved: AnyResolvedMessageDefinition,
  requested: readonly string[] | undefined,
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
    return checkEmail(resolved, allowed.filter((key) => list.includes(key)));
  }
  return checkEmail(resolved, allowed);
}

function checkEmail(resolved: AnyResolvedMessageDefinition, list: string[]): string[] {
  if (resolved.required && !list.includes("email")) {
    throw new DomainError(`止められない連絡から email は外せません(${resolved.key})`, { status: 400 });
  }
  return list;
}

/**
 * 生成の一覧の全件を確かめる(L2.2。テストと出荷前の検査が呼ぶ):
 * 鍵が合う・上書きを重ね種類を付けた定義が validateMessageDefinition を通る・種類の経路の全部で描ける(組み立てを差し込み無しで通す)。
 * @returns 誤りの文(空 = 全件よい)
 */
export async function checkMessageRegistry(deps: ResolveDefinitionDeps & MessageContentDeps): Promise<string[]> {
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
      const resolved = await resolveDefinition(message, deps);
      if (!resolved.authored) await buildContents(deps, resolved, resolved.channels, {});
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return problems;
}
