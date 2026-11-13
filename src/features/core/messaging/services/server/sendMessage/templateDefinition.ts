// src/features/core/messaging/services/server/sendMessage/templateDefinition.ts
//
// 保存されたテンプレートの版 → 送る口の定義(D40・D41)。
// - 鍵は送るカテゴリーの種別の管理の定義の鍵(messaging.adminAnnouncement・adminDirect・adminMarketing、admin/freeText.ts。宛名の enricher
//   displayName もこの鍵に当たる)。種別が announcement・direct・marketing でないカテゴリーは 400(sendTemplate も cron の組み直しも)。
//   回は template_id + template_version で版を固定し、cron もその版から組み直す(最新を引き直さない)
// - 文言は版から、または送る時に直した文言(D85。回に template_edited と直した文言 template_content を残し、cron はそれで組み直す)。
//   種類は版の種類(呼び手が送る時の種類を渡せる)。種別と経路は種類から(D86)。経路 = 種類の経路 ∩ 絞り、文言の無い経路は 400
// - 生成の一覧の上書き(fork の override)と管理画面の文言は重ねない
// - 変数: 版の変数の全部を vars にする(値は文字列にして差し込む)。型 number / boolean は形を確かめる、それ以外は文字列。
//   必須で値が無い・型が合わない = vars の検査で 400(送る時の再検査 = cron が回の vars をもう一度この zod に通す)
// - 受信者ごとの変数(source recipient)は送る口から受信者ごとに渡す口が無いので、既定値を全員に使う(既定値が無ければ 400)

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

import { adminFreeTextMessageKeyOf } from "../admin/freeText";
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

/** 版 → 定義(検査の前)。key = 送るカテゴリーの種別の管理の定義の鍵、content = 送る文言(既定 = 版の文言) */
export function templateDefinitionOf(
  version: MessageTemplateVersionSource,
  category: string,
  key: string,
  content: Record<string, unknown> = version.content,
): AnyMessageDefinition {
  const shape = Object.fromEntries(
    version.variables.map((variable) => {
      // 受信者ごとの変数は既定値を全員に使う(値は渡させない)
      const fixed = variable.source === "recipient" ? { ...variable, required: false } : variable;
      return [variable.key, variableSchema(fixed)];
    }),
  );
  return {
    key,
    category,
    vars: z.object(shape),
    record: "vars",
    content,
  } as unknown as AnyMessageDefinition;
}

/** 文言の中の storage:// の参照(画像) */
function storageRefsOf(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (value.startsWith("storage://")) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) storageRefsOf(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) storageRefsOf(item, out);
  }
  return out;
}

/** 版の文言から直したか(送る文言が版の文言と違う) */
export function templateContentEdited(version: MessageTemplateVersionSource, content: Record<string, unknown> | undefined): boolean {
  return content !== undefined && !isDeepStrictEqual(content, version.content);
}

/**
 * 版(と直した文言)を送れる定義にする(検査を通す。上書きは重ねない)。
 * - 経路 = 種類の経路 ∩ その回の絞り(D86)。その中に文言の無い経路が 1 つでもあれば 400(黙って落とさない、D85)
 * - 直した文言の画像(storage://)は版の文言にある物だけ(画像を足す口は送るモーダル、指令 40)
 * @throws DomainError(400) 種別・絞り・文言の無い経路・画像 / (500) 種類が無い・文言が今の経路・値の束に合わない
 */
export function resolveTemplateDefinition(
  version: MessageTemplateVersionSource,
  deps: {
    channels: Readonly<Record<string, MessageChannel>>;
    enrichers: Readonly<Record<string, MessageEnricher>>;
    categories: Readonly<Record<string, MessageCategory>>;
  },
  options: { category?: string; channels?: readonly string[]; content?: Record<string, unknown> } = {},
): AnyResolvedMessageDefinition {
  const categoryKey = options.category ?? version.category;
  const category = deps.categories[categoryKey];
  const label = `テンプレート ${version.templateKey} の版 ${version.version}`;
  if (!category) throw new DomainError(`${label} の種類 ${categoryKey} がありません`, { status: 500 });
  const key = adminFreeTextMessageKeyOf(category.kind);
  if (!key) {
    throw new DomainError(
      `${label} はカテゴリー ${categoryKey}(種別 ${category.kind})では送れません(テンプレートは announcement・direct・marketing のカテゴリーで送る)`,
      { status: 400 },
    );
  }
  const narrowing = options.channels ? [...new Set(options.channels)] : null;
  if (narrowing) {
    const outside = narrowing.filter((channel) => !category.channels.includes(channel));
    if (outside.length > 0 || narrowing.length === 0) {
      throw new DomainError(
        `送る経路 ${outside.join(", ") || "(空)"} は種類 ${categoryKey} の経路(${category.channels.join(" / ")})の中の絞りにします`,
        { status: 400 },
      );
    }
  }
  const used = narrowing ? category.channels.filter((channel) => narrowing.includes(channel)) : [...category.channels];
  const source = options.content ?? version.content;
  const missing = used.filter((channel) => source[channel] === undefined || source[channel] === null);
  if (missing.length > 0) {
    throw new DomainError(`${label}: 経路 ${missing.join(", ")} の文言がありません(書くか、送る経路から外してください)`, { status: 400 });
  }
  if (options.content) {
    const allowed = storageRefsOf(version.content);
    const added = [...storageRefsOf(options.content)].filter((ref) => !allowed.has(ref));
    if (added.length > 0) throw new DomainError(`${label}: 直した文言に版に無い画像は入れられません`, { status: 400 });
  }
  const content = Object.fromEntries(used.map((channel) => [channel, source[channel]]));
  const narrowed = { ...category, channels: used };
  const definition = templateDefinitionOf(version, categoryKey, key, content);
  const problems = validateMessageDefinition(definition, {
    categories: { [categoryKey]: narrowed },
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(key, deps.enrichers),
  });
  if (problems.length > 0) {
    // 直した文言の誤りは入力の誤り(400)、版のままの誤りは保存の検査をすり抜けた物(500)
    throw new DomainError(`${label} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`, {
      status: options.content ? 400 : 500,
    });
  }
  return resolveMessageDefinition(definition, undefined, narrowed);
}
