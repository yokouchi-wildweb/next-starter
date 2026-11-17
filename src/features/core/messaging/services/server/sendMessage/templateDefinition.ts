// src/features/core/messaging/services/server/sendMessage/templateDefinition.ts
//
// 管理の送信(テンプレート + 欄の中身、D117・D125)→ 送る口の定義。システムテンプレート(白紙)も DB のテンプレートも同じ組み方:
// - 出どころ: { system: 鍵 }(受け口 messaging/templates の白紙)か { id, version }(DB のテンプレートの今の公開版)
// - 鍵は TEMPLATE_MESSAGE_KEY(コードの連絡の鍵ではない。回の message_key は null で、出どころは system_template か template_id + 版)
// - 種別と経路は送るカテゴリーから(D86)。カテゴリーの種別は管理者がその場で送れる種別(性質 adminFreeText)だけ、白紙は種別が同じカテゴリーだけ(400)
// - 欄の中身(values)= ひな形の欄の中身(白紙の layout、DB のテンプレートは notice)。ひな形の欄の zod で検査し、{{鍵}} = 当たる enrichers の鍵 +
//   テンプレートの版の変数 + 共通の文脈、知らない鍵は 400
// - DB のテンプレートの版の中身は S4 まで経路ごとの形なので、notice の欄の中身に読み替えて直した印を決める(utils/noticeValues.ts)
// - 画像(storage://)は欄の中身に自由に入れられる(送る口がお知らせの行を書く時に回へ結ぶ)
// - テンプレートの版(version)がある時: 版の変数の全部を vars にする(値は文字列にして差し込む)。型 number / boolean は形を確かめる、
//   それ以外は文字列。必須で値が無い・型が合わない = vars の検査で 400。受信者ごとの変数(source recipient)は既定値を全員に使う(既定値が無ければ 400)
// - 生成の一覧の上書きは重ねない

import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  COMMON_CONTEXT_KEYS,
  resolveMessageDefinition,
  validateMessageDefinition,
  type MessageCategory,
  type MessageChannel,
  type MessageEnricher,
  type MessageKey,
  type MessageLayout,
  type MessageSystemTemplate,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import { listVariables } from "@/lib/structuredDocument/shared";

import { noticeValuesFromChannelContent } from "../../../utils/noticeValues";
import { channelFieldSchemas, enricherKeysFor, type AnyMessageDefinition, type AnyResolvedMessageDefinition } from "./definition";
import { adminSendableKinds, isAdminSendableKind } from "./systemTemplates";
import type { MessageTemplateVersionSource } from "./types";

/** テンプレートから送る回の定義の鍵(コードの連絡の鍵ではない。回の message_key には書かない) */
export const TEMPLATE_MESSAGE_KEY = "messaging.template" as MessageKey;

/** DB のテンプレートの版のひな形(S4 まで経路ごとの文面を notice に読み替える) */
export const DB_TEMPLATE_LAYOUT = "notice";

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

/** DB のテンプレートの版の欄の中身(経路ごとの文面を notice の欄の中身に読み替える) */
export function templateVersionValues(version: MessageTemplateVersionSource): Record<string, unknown> {
  return noticeValuesFromChannelContent(version.content);
}

/** 版の中身から直したか(送る中身が版の中身と違う) */
export function templateValuesEdited(version: MessageTemplateVersionSource, values: Record<string, unknown>): boolean {
  return !isDeepStrictEqual(values, templateVersionValues(version));
}

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/** 送る中身の出どころ(組み済み): 白紙か DB のテンプレートの版 */
export type TemplateSource = { system: MessageSystemTemplate } | { version: MessageTemplateVersionSource };

/** 中身 → 定義(検査の前)。version = テンプレートの版(変数の宣言) */
export function templateDefinitionOf(
  source: TemplateSource,
  category: string,
  values: Record<string, unknown>,
): AnyMessageDefinition {
  const version = "version" in source ? source.version : undefined;
  const shape = Object.fromEntries(
    (version?.variables ?? []).map((variable) => {
      // 受信者ごとの変数は既定値を全員に使う(値は渡させない)
      const fixed = variable.source === "recipient" ? { ...variable, required: false } : variable;
      return [variable.key, variableSchema(fixed)];
    }),
  );
  const label = "system" in source ? source.system.label : `テンプレート ${source.version.templateKey}`;
  const layout = "system" in source ? source.system.layout : DB_TEMPLATE_LAYOUT;
  return { key: TEMPLATE_MESSAGE_KEY, label, category, vars: z.object(shape), layout, values } as unknown as AnyMessageDefinition;
}

/**
 * テンプレート + 中身を送れる定義にする(検査を通す。上書きは重ねない)。
 * @throws DomainError(400) カテゴリーの種別・白紙の種別・絞り・欄・{{鍵}} / (500) 種類が無い
 */
export function resolveTemplateDefinition(
  deps: {
    channels: Readonly<Record<string, MessageChannel>>;
    enrichers: Readonly<Record<string, MessageEnricher>>;
    categories: Readonly<Record<string, MessageCategory>>;
    layouts: Readonly<Record<string, MessageLayout>>;
  },
  input: { category: string; values: Record<string, unknown>; channels?: readonly string[]; source: TemplateSource },
): AnyResolvedMessageDefinition {
  const { source } = input;
  const category = deps.categories[input.category];
  const label =
    "system" in source ? `システムテンプレート ${source.system.key}` : `テンプレート ${source.version.templateKey} の版 ${source.version.version}`;
  if (!category) throw new DomainError(`${label} の種類 ${input.category} がありません`, { status: 500 });
  if (!isAdminSendableKind(category.kind)) {
    throw new DomainError(
      `${label} はカテゴリー ${input.category}(種別 ${category.kind})では送れません(${adminSendableKinds().join("・")} のカテゴリーで送る)`,
      { status: 400 },
    );
  }
  if ("system" in source && source.system.kind !== category.kind) {
    throw new DomainError(
      `${label}(種別 ${source.system.kind})はカテゴリー ${input.category}(種別 ${category.kind})では送れません(同じ種別のカテゴリーで送る)`,
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
  const narrowed = { ...category, channels: used };
  const definition = templateDefinitionOf(source, input.category, input.values);
  const enricherKeys = enricherKeysFor({ key: definition.key, category: input.category, kind: category.kind }, deps.enrichers);
  const known = new Set<string>([...Object.keys(definition.vars.shape), ...COMMON_CONTEXT_KEYS, ...enricherKeys]);
  const unknownKeys = [...new Set(collectStrings(input.values, []).flatMap((value) => listVariables(value)))].filter((key) => !known.has(key));
  if (unknownKeys.length > 0) {
    throw new DomainError(`${label} を送れません: ${unknownKeys.map((key) => `{{${key}}}`).join(", ")} は変数にも共通の文脈にも無い`, { status: 400 });
  }
  const problems = validateMessageDefinition(definition, {
    categories: { [input.category]: narrowed },
    layouts: deps.layouts,
    channels: channelFieldSchemas(deps.channels),
    variableKeys: enricherKeys,
  });
  if (problems.length > 0) {
    throw new DomainError(`${label} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`, { status: 400 });
  }
  return resolveMessageDefinition(definition, undefined, narrowed);
}
