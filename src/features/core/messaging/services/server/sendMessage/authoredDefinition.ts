// src/features/core/messaging/services/server/sendMessage/authoredDefinition.ts
//
// 管理者が書いた文面(その場で書く連絡・テンプレートを呼び出して直した文面、D85・D92)→ 送る口の定義。両方とも同じ組み方:
// - 鍵は送るカテゴリーの種別の管理の定義(authored)の鍵(messaging.adminAnnouncement・adminDirect・adminMarketing、admin/freeText.ts。宛名の
//   enricher displayName もこの鍵に当たる)。種別が announcement・direct・marketing でないカテゴリーは 400(送る時も cron の組み直しも)
// - 種別と経路は種類から(D86)。経路 = 種類の経路 ∩ その回の絞り、その中に文面の無い経路が 1 つでもあれば 400(黙って落とさない)
// - 経路ごとの欄は経路の受け口の zod で検査する(fork の経路も)。{{鍵}} = 当たる enrichers の鍵 + テンプレートの版の変数、知らない鍵は 400
// - 画像(storage://)は文面に自由に入れられる(送る口がお知らせの行を書く時に回へ結ぶ: 自分の上げた画像は attach、ほかは複製)
// - テンプレートの版(version)がある時: 版の変数の全部を vars にする(値は文字列にして差し込む)。型 number / boolean は形を確かめる、
//   それ以外は文字列。必須で値が無い・型が合わない = vars の検査で 400(cron が回の vars をもう一度この zod に通す = 送る時の再検査)。
//   受信者ごとの変数(source recipient)は送る口から受信者ごとに渡す口が無いので、既定値を全員に使う(既定値が無ければ 400)
// - 生成の一覧の上書きは重ねない(authored の定義は上書きを持てない)

import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  resolveMessageDefinition,
  validateMessageDefinition,
  type MessageCategory,
  type MessageChannel,
  type MessageEnricher,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { ADMIN_FREE_TEXT_DEFINITIONS, isAdminFreeTextKind } from "../admin/freeText";
import { channelFieldSchemas, enricherKeysFor, type AnyMessageDefinition, type AnyResolvedMessageDefinition } from "./definition";
import type { MessageTemplateVersionSource } from "./types";

type TemplateVariable = MessageTemplateVersionSource["variables"][number];

const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;

/** 値を差し込む文字列にする(型が合わなければ null) */
function toText(type: string, value: unknown): string | null {
  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && NUMBER_TEXT.test(value.trim())) return value.trim();
    return null;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return String(value);
    if (value === "true" || value === "false") return value;
    return null;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function variableSchema(variable: TemplateVariable): z.ZodTypeAny {
  return z.unknown().transform((value, ctx) => {
    const empty = value === undefined || value === null || value === "";
    if (empty) {
      if (variable.default !== undefined && variable.default !== null) {
        const text = toText(variable.type, variable.default);
        if (text !== null) return text;
      }
      if (!variable.required) return "";
      ctx.addIssue({ code: "custom", message: `${variable.key} は必須です` });
      return z.NEVER;
    }
    const text = toText(variable.type, value);
    if (text === null) {
      ctx.addIssue({ code: "custom", message: `${variable.key} の型が ${variable.type} ではありません` });
      return z.NEVER;
    }
    return text;
  });
}

/**
 * 受信者ごとの変数で既定値の無い物(送る口からは値を渡せないので送れない)
 */
export function recipientVariablesWithoutDefault(version: MessageTemplateVersionSource): string[] {
  return version.variables
    .filter((variable) => variable.source === "recipient" && (variable.default === undefined || variable.default === null))
    .map((variable) => variable.key);
}

/** 版の文面から直したか(送る文面が版の文面と違う) */
export function templateContentEdited(version: MessageTemplateVersionSource, content: Record<string, unknown>): boolean {
  return !isDeepStrictEqual(content, version.content);
}

/** 書いた文面 → 定義(検査の前)。base = カテゴリーの種別の authored の定義、version = テンプレートの版(変数の宣言) */
export function authoredDefinitionOf(
  base: AnyMessageDefinition,
  category: string,
  content: Record<string, unknown>,
  version?: MessageTemplateVersionSource,
): AnyMessageDefinition {
  const shape = Object.fromEntries(
    (version?.variables ?? []).map((variable) => {
      // 受信者ごとの変数は既定値を全員に使う(値は渡させない)
      const fixed = variable.source === "recipient" ? { ...variable, required: false } : variable;
      return [variable.key, variableSchema(fixed)];
    }),
  );
  const { authored: _authored, ...rest } = base as AnyMessageDefinition & { authored?: true };
  return { ...rest, category, vars: z.object(shape), content } as unknown as AnyMessageDefinition;
}

/**
 * 書いた文面を送れる定義にする(検査を通す。上書きは重ねない)。
 * @throws DomainError(400) カテゴリーの種別・絞り・文面の無い経路・欄・{{鍵}} / (500) 種類が無い
 */
export function resolveAuthoredDefinition(
  deps: {
    channels: Readonly<Record<string, MessageChannel>>;
    enrichers: Readonly<Record<string, MessageEnricher>>;
    categories: Readonly<Record<string, MessageCategory>>;
  },
  input: { category: string; content: Record<string, unknown>; channels?: readonly string[]; version?: MessageTemplateVersionSource },
): AnyResolvedMessageDefinition {
  const { version } = input;
  const category = deps.categories[input.category];
  const label = version ? `テンプレート ${version.templateKey} の版 ${version.version}` : "書いた文面";
  if (!category) throw new DomainError(`${label} の種類 ${input.category} がありません`, { status: 500 });
  if (!isAdminFreeTextKind(category.kind)) {
    throw new DomainError(
      `${label} はカテゴリー ${input.category}(種別 ${category.kind})では送れません(announcement・direct・marketing のカテゴリーで送る)`,
      { status: 400 },
    );
  }
  const narrowing = input.channels ? [...new Set(input.channels)] : null;
  if (narrowing) {
    const outside = narrowing.filter((channel) => !category.channels.includes(channel));
    if (outside.length > 0 || narrowing.length === 0) {
      throw new DomainError(
        `送る経路 ${outside.join(", ") || "(空)"} は種類 ${input.category} の経路(${category.channels.join(" / ")})の中の絞りにします`,
        { status: 400 },
      );
    }
  }
  const used = narrowing ? category.channels.filter((channel) => narrowing.includes(channel)) : [...category.channels];
  const missing = used.filter((channel) => input.content[channel] === undefined || input.content[channel] === null);
  if (missing.length > 0) {
    throw new DomainError(`${label}: 経路 ${missing.join(", ")} の文面がありません(書くか、送る経路から外してください)`, { status: 400 });
  }
  const content = Object.fromEntries(used.map((channel) => [channel, input.content[channel]]));
  const narrowed = { ...category, channels: used };
  const base = ADMIN_FREE_TEXT_DEFINITIONS[category.kind] as unknown as AnyMessageDefinition;
  const definition = authoredDefinitionOf(base, input.category, content, version);
  const problems = validateMessageDefinition(definition, {
    categories: { [input.category]: narrowed },
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(definition.key, deps.enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(`${label} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`, { status: 400 });
  }
  return resolveMessageDefinition(definition, undefined, narrowed);
}
