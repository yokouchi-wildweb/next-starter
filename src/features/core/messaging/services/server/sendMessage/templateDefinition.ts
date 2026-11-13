// src/features/core/messaging/services/server/sendMessage/templateDefinition.ts
//
// 保存されたテンプレートの版 → 送る口の定義(D40・D41)。
// - 鍵は送るカテゴリーの種別の管理の定義の鍵(messaging.adminAnnouncement・adminDirect・adminMarketing、admin/freeText.ts。宛名の enricher
//   displayName もこの鍵に当たる)。種別が announcement・direct・marketing でないカテゴリーは 400(sendTemplate も cron の組み直しも)。
//   回は template_id + template_version で版を固定し、cron もその版から組み直す(最新を引き直さない)
// - 中身は版から、種類は版の種類(呼び手が送る時の種類を渡せる: 管理の送信の仮の種類・回に残した種類で cron が組み直す)。
//   種別と経路は種類から(D86)。版の経路はその種類の経路の中の絞り(種類の外の経路があれば 400、Q6)
// - 生成の一覧の上書き(fork の override)と管理画面の文言は重ねない
// - 変数: 版の変数の全部を vars にする(値は文字列にして差し込む)。型 number / boolean は形を確かめる、それ以外は文字列。
//   必須で値が無い・型が合わない = vars の検査で 400(送る時の再検査 = cron が回の vars をもう一度この zod に通す)
// - 受信者ごとの変数(source recipient)は送る口から受信者ごとに渡す口が無いので、既定値を全員に使う(既定値が無ければ 400)

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

/** 版 → 定義(検査の前)。key = 送るカテゴリーの種別の管理の定義の鍵 */
export function templateDefinitionOf(version: MessageTemplateVersionSource, category: string, key: string): AnyMessageDefinition {
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
    content: version.content,
  } as unknown as AnyMessageDefinition;
}

/**
 * 版を送れる定義にする(検査を通す。上書きは重ねない)。経路 = 種類の経路 ∩ 版の経路。
 * @throws DomainError(400) 版の経路が種類の経路の外 / (500) 種類が無い・版の中身が今の経路・値の束に合わない
 */
export function resolveTemplateDefinition(
  version: MessageTemplateVersionSource,
  deps: {
    channels: Readonly<Record<string, MessageChannel>>;
    enrichers: Readonly<Record<string, MessageEnricher>>;
    categories: Readonly<Record<string, MessageCategory>>;
  },
  options: { category?: string } = {},
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
  const outside = version.channels.filter((channel) => !category.channels.includes(channel));
  if (outside.length > 0) {
    throw new DomainError(
      `${label} の経路 ${outside.join(", ")} は種類 ${categoryKey} の経路(${category.channels.join(" / ")})に無いので送れません`,
      { status: 400 },
    );
  }
  const narrowed = { ...category, channels: category.channels.filter((channel) => version.channels.includes(channel)) };
  const definition = templateDefinitionOf(version, categoryKey, key);
  const problems = validateMessageDefinition(definition, {
    categories: { [categoryKey]: narrowed },
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeysFor(key, deps.enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(`${label} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`, { status: 500 });
  }
  return resolveMessageDefinition(definition, undefined, narrowed);
}
