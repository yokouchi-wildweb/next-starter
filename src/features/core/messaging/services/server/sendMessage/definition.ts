// src/features/core/messaging/services/server/sendMessage/definition.ts
//
// 定義を送れる形にする: 生成の一覧の上書きを重ね、属するカテゴリー(category)から種別と送信チャンネルを付け(resolveMessageDefinition)、検査を通す
// (レイアウトが受け口にある・欄の中身がレイアウトの欄の zod を通る・{{鍵}} が宣言済み)。
// 管理画面のテキストの編集(message_overrides、欄の道 = レイアウトの欄の鍵)は門 messagingOverrides が開の時に最後に欄ごとに重ねる
// (D21: 管理画面 > fork の override > 上流)。行は保存した版から今の版へ移し、移せない・検査を通らない行は当てずコードの値(警告 1 行)。
// 重ねた値は送信の values に残るので、予約・後回しの組み直しは送った時の文言のまま(D128。後でテキストを編集し直しても変わらない)

import type { z } from "zod";

import {
  adminEditableFields,
  applyAdminFieldValues,
  definitionChannels,
  isLayoutAdminSelectable,
  isLayoutUsable,
  messageCategoryKeyOf,
  resolveMessageDefinition,
  validateMessageDefinition,
  type AdminFieldValue,
  type MessageCategory,
  type MessageChannel,
  type MessageDefinition,
  type MessageEnricher,
  type MessageLayout,
  type MessageOverride,
  type MessageRegistry,
  type ResolvedMessageDefinition,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { buildContents, type MessageContentDeps } from "./content";
import { enricherKeysFor, messageSharedVars } from "./enrichers";

/** 送る口が受ける定義 */
export type AnyMessageDefinition = MessageDefinition<z.AnyZodObject>;
export type AnyResolvedMessageDefinition = ResolvedMessageDefinition<z.AnyZodObject>;

/** 上流の送信チャンネルの鍵(受け口に項目が無くても登録済みとして扱う。定義の検査の送信チャンネルの有無) */
const UPSTREAM_CHANNEL_KEYS = ["email", "inApp", "line"] as const;

/** 登録された送信チャンネルの鍵(上流の 3 送信チャンネル + 送信チャンネルの受け口の項目) */
export function registeredChannelKeys(channels: Readonly<Record<string, MessageChannel>>): string[] {
  return [...new Set<string>([...UPSTREAM_CHANNEL_KEYS, ...Object.values(channels).map((channel) => channel.key)])];
}

// 当て先で選ぶ enrichers は ./enrichers.ts(context.ts も使う。輪を作らないよう別のファイル)
export { enrichersFor, enricherKeysFor } from "./enrichers";

/** 定義を送れる形にする部品(送る口の deps の一部) */
export type ResolveDefinitionDeps = {
  registry: MessageRegistry;
  channels: Readonly<Record<string, MessageChannel>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  /** categories の受け口(fork のカテゴリーの override を重ねた後) */
  categories: Readonly<Record<string, MessageCategory>>;
  /** レイアウトの受け口(server の一覧 layouts) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** テキストの編集(無い・enabled() が false = 重ねない。テキストの編集の service はコードの値を見るので渡さない) */
  adminOverrides?: MessageAdminOverrideSource;
};

/** テキストの編集の読み口(門 messagingOverrides が開か・連絡の行) */
export type MessageAdminOverrideSource = {
  enabled: () => boolean;
  load: (messageKey: string) => Promise<AdminFieldValue[]>;
};

/**
 * 上書きを重ね、カテゴリーから種別と送信チャンネルを付けて検査した定義を返す。上書きは生成の一覧(messageRegistry)の項目から読む。
 * adminOverrides があり門が開なら、管理画面のテキストの編集を 1 回読んで欄ごとに重ねる(当てられない行はコードの値のまま、警告だけ)。
 * options.category = 送る時に決めたカテゴリー(送信に残したカテゴリーで cron が組み直す・管理の送信の仮のカテゴリー)。省略 = 定義のカテゴリー
 * @throws DomainError(500) 定義か上書きに誤りがある(呼び手の入力ではなくコードの誤り)
 */
export async function resolveDefinition(
  source: AnyMessageDefinition,
  deps: ResolveDefinitionDeps,
  options: { category?: string } = {},
): Promise<AnyResolvedMessageDefinition> {
  const entry = deps.registry[source.key];
  const loaded: MessageOverride | undefined = entry?.override
    ? (await entry.override()).messageOverride
    : undefined;
  // 属するカテゴリー = 送る時に決めた物(送信に残したカテゴリー)> 上書きの付け替え(D166)> 定義。送る時に決めた物があれば上書きの付け替えは使わない
  const definition = { ...source, category: options.category ?? messageCategoryKeyOf(source, loaded) } as AnyMessageDefinition;
  // 付け替えは定義の category に写したので、上書きの category は外す(送る時に決めた物を上書きが替えない)
  const override: MessageOverride | undefined = loaded ? { ...loaded, category: undefined } : undefined;

  const message = {
    key: definition.key,
    category: definition.category,
    kind: deps.categories[definition.category]?.kind ?? "transactional",
    vars: definition.vars,
  };
  const problems = validateMessageDefinition(definition, {
    categories: deps.categories,
    override,
    layouts: deps.layouts,
    channels: registeredChannelKeys(deps.channels),
    variableKeys: enricherKeysFor(message, deps.enrichers),
    // vars の別名(D133)が重ならないか照らす相手: 共通 + 当たる enrichers + enricher と同じ鍵の vars
    sharedVarNames: messageSharedVars(message, deps.enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(
      `連絡の定義に誤りがあります(${definition.key}): ${problems.map((problem) => problem.message).join(" / ")}`,
      { status: 500 },
    );
  }
  const resolved = resolveMessageDefinition(definition, override, deps.categories[definition.category]!);
  const adminOverrides = deps.adminOverrides;
  const layout = deps.layouts[resolved.layout];
  if (!adminOverrides || !layout || !adminOverrides.enabled()) return resolved;
  if (adminEditableFields(resolved, layout).length === 0) return resolved;
  const rows = await adminOverrides.load(definition.key);
  if (rows.length === 0) return resolved;
  const merged = applyAdminFieldValues(resolved, layout, rows, {
    variableKeys: enricherKeysFor(resolved, deps.enrichers),
  });
  for (const { fieldPath, problem } of merged.rejected) {
    console.warn(`[messaging] テキストの編集を使わずコードの値で送ります(${definition.key} ${fieldPath}): ${problem.message}`);
  }
  return merged.resolved;
}

/**
 * 使う送信チャンネルを決める: カテゴリーの送信チャンネル(D86)に連絡定義の固定(channelModes、D212)を当てる。
 * - コードの送信(requested なし): カテゴリーの送信チャンネルから off を落とした全部(on と free)
 * - 管理の手で送る時・テンプレートの版の送信チャンネル(requested): その送信だけの絞り。カテゴリーの外・off の送信チャンネルと空の絞りは拒む
 *   (足すことはできない)。on はいつも入る(管理者は自由な物だけを選ぶ、D213)
 * 止められない連絡から email は外せない。描けない送信チャンネルは組み立て(sendMessage/content.ts)が送信を書く前に止める
 * @throws DomainError(400)
 */
export function resolveChannels(
  resolved: AnyResolvedMessageDefinition,
  requested: readonly string[] | undefined,
): string[] {
  const allowed = [...resolved.channels] as string[];
  const { on, off } = definitionChannels(resolved);
  const usable = allowed.filter((key) => !off.includes(key));
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
    const fixedOff = list.filter((key) => off.includes(key));
    if (fixedOff.length > 0) {
      throw new DomainError(`送信チャンネル ${fixedOff.join(", ")} はこの連絡では使いません(連絡定義の固定 off、${resolved.key})`, { status: 400 });
    }
    return checkEmail(resolved, usable.filter((key) => list.includes(key) || on.includes(key)));
  }
  return checkEmail(resolved, usable);
}

function checkEmail(resolved: AnyResolvedMessageDefinition, list: string[]): string[] {
  if (resolved.required && !list.includes("email")) {
    throw new DomainError(`止められない連絡から email は外せません(${resolved.key})`, { status: 400 });
  }
  return list;
}

/**
 * 送る画面・テンプレートの編集の最初のレイアウト(config の messaging.initialLayout)の誤り。受け口にあり、使えて(disabled でない)管理画面で選べること。
 * 黙ってほかのレイアウトに替えない(管理者が受け取る物が知らずに変わらない): 誤りは検査が止める
 * @returns 誤りの文(null = よい)
 */
export function initialLayoutProblem(initialLayout: string, layouts: Readonly<Record<string, MessageLayout>>): string | null {
  const layout = layouts[initialLayout];
  if (!layout) return `config の messaging.initialLayout ${initialLayout} は layouts の受け口に無い(${Object.keys(layouts).join(" / ") || "項目なし"})`;
  if (!isLayoutUsable(layout)) return `config の messaging.initialLayout ${initialLayout}(${layout.label})は無効(disabled)のレイアウト。initialLayout を管理画面で選べるレイアウトに替える`;
  if (!isLayoutAdminSelectable(layout)) return `config の messaging.initialLayout ${initialLayout}(${layout.label})は管理画面で選べないレイアウト(adminSelectable でない)。initialLayout を管理画面で選べるレイアウトに替える`;
  return null;
}

/**
 * 生成の一覧の全件を確かめる(L2.2。テストと出荷前の検査が呼ぶ):
 * 鍵が合う・上書きを重ねカテゴリーを付けた定義が validateMessageDefinition を通る(無効のレイアウトを使う定義は止まる)・カテゴリーの送信チャンネルの全部で描ける
 * (組み立てを差し込み無しで通す)。config の initialLayout が管理画面で選べる使えるレイアウトであること(initialLayoutProblem)も同じ検査で見る。
 * @returns 誤りの文(空 = 全件よい)
 */
export async function checkMessageRegistry(deps: ResolveDefinitionDeps & MessageContentDeps & { initialLayout: string }): Promise<string[]> {
  const { registry } = deps;
  const problems: string[] = [];
  const initial = initialLayoutProblem(deps.initialLayout, deps.layouts);
  if (initial) problems.push(initial);
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
      await buildContents(deps, resolved, resolved.channels, {});
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return problems;
}
