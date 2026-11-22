// src/features/core/messaging/services/server/sendMessage/templateDefinition.ts
//
// 自由連絡(カテゴリー + レイアウト + 欄の中身、D117・D125・D171)→ 送る口の定義。レイアウトを直に選んだ物も DB のテンプレートも同じ組み方:
// - 出どころ: { layout }(管理画面で選べるレイアウト = adminSelectable だけ、sender.ts が確かめる)か { id, version }(DB のテンプレートの今の公開版)
// - 鍵は TEMPLATE_MESSAGE_KEY(定義連絡の鍵ではない。送信の message_key は null で、出どころはレイアウトだけか template_id + 版)
// - 種別と送信チャンネルは送るカテゴリーから(D86)。カテゴリーの種別は自由連絡で送れる種別(性質 adminFreeText)だけ(400)
// - レイアウト = 選んだレイアウトか DB のテンプレートの版のレイアウト。欄の中身(values)はそのレイアウトの欄の zod で検査する
// - 埋め込み情報: 一覧 = 共通 + 当たる enrichers + DB のテンプレートの版が宣言した物。文面の {{鍵}} / {{別名}} が一覧に無ければ 400。
//   専用の値は版の宣言の型で検査する(必須・既定値、varValuesSchema)。値は定義の vars として差し込み、送信の vars に残す(sender.ts)
// - 専用の別名 {{開始日時}} は {{鍵}} に書き換えてから定義にする(送信に残す中身は鍵だけ: cron の組み直しは宣言を引き直さない)。
//   共通・enrichers の別名は差し込みの表が埋める(content.ts)
// - 直した印 = 送る中身(書き換えの前)が版の中身(今のレイアウトの版へ読み替えた物)と違う
// - 画像(storage://)は欄の中身に自由に入れられる(送る口がお知らせの行を書く時に送信へ結ぶ)
// - 生成の一覧の上書きは重ねない

import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import {
  checkVarCatalog,
  varCatalog,
  varValuesSchema,
  findVar,
  kindsWhere,
  kindTraits,
  MESSAGE_VAR_TYPE_LABELS,
  normalizeLayoutValues,
  resolveMessageDefinition,
  upgradeLayoutValues,
  validateMessageDefinition,
  type MessageCategory,
  type MessageChannel,
  type MessageVarDeclaration,
  type MessageEnricher,
  type MessageKey,
  type MessageKind,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import { replaceVariables } from "@/lib/templateVariables";

import { enricherKeysFor, enrichersFor, type AnyMessageDefinition, type AnyResolvedMessageDefinition, registeredChannelKeys } from "./definition";
import type { MessageTemplateVersionSource } from "./types";

/** 自由連絡で送れる種別(種別の性質 adminFreeText がある物) */
export function adminSendableKinds(): MessageKind[] {
  return kindsWhere((traits) => traits.adminFreeText.length > 0);
}

/** 自由連絡で送れる種別か */
export function isAdminSendableKind(kind: string | null | undefined): kind is MessageKind {
  return (kindTraits(kind)?.adminFreeText.length ?? 0) > 0;
}

/** 自由連絡の送信の定義の鍵(定義連絡の鍵ではない。送信の message_key には書かない) */
export const TEMPLATE_MESSAGE_KEY = "messaging.template" as MessageKey;

/**
 * DB のテンプレートの版の欄の中身(今のレイアウトの版へ読み替えた物)。
 * @throws DomainError(409) レイアウトが無い・版が読めない
 */
export function templateVersionValues(
  layouts: Readonly<Record<string, MessageLayout>>,
  version: MessageTemplateVersionSource,
): Record<string, unknown> {
  const layout = layouts[version.layout];
  if (!layout) throw new DomainError(`テンプレート ${version.templateKey} のレイアウト ${version.layout} がありません`, { status: 409 });
  const upgraded = upgradeLayoutValues(layout, version.values, version.layoutVersion);
  if ("cannotRender" in upgraded) throw new DomainError(upgraded.cannotRender, { status: 409 });
  return upgraded.values;
}

/** 欄の中身の空を「無い」にする(D128、レイアウトが無ければそのまま。送る口の入口とくらべる前に通す) */
function normalizedValues(layouts: Readonly<Record<string, MessageLayout>>, layoutKey: string, values: Record<string, unknown>): Record<string, unknown> {
  const layout = layouts[layoutKey];
  return layout ? (normalizeLayoutValues(layout.fields, values) as Record<string, unknown>) : values;
}

/** 版の中身から直したか(送る中身が版の中身と違う。どちらも空を「無い」にしてくらべる) */
export function templateValuesEdited(
  layouts: Readonly<Record<string, MessageLayout>>,
  version: MessageTemplateVersionSource,
  values: Record<string, unknown>,
): boolean {
  return !isDeepStrictEqual(
    normalizedValues(layouts, version.layout, values),
    normalizedValues(layouts, version.layout, templateVersionValues(layouts, version)),
  );
}

/** 欄の中身の文字の中の専用の別名 {{別名}} を {{鍵}} に書き換える(入れ子の object・配列も) */
export function canonicalVarNames(value: unknown, declarations: readonly MessageVarDeclaration[]): unknown {
  if (declarations.length === 0) return value;
  const map = Object.fromEntries(declarations.map((declaration) => [declaration.alias, `{{${declaration.key}}}`]));
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") return replaceVariables(item, map);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, inner]) => [key, visit(inner)]));
    return item;
  };
  return visit(value);
}

/** 自由連絡の出どころ(組み済み): 選んだレイアウトか DB のテンプレートの版 */
export type FreeSource = { layout: MessageLayout } | { version: MessageTemplateVersionSource };

/** 出どころの埋め込み情報の宣言(DB のテンプレートの版だけが持つ) */
export function templateVarsOf(source: FreeSource): MessageVarDeclaration[] {
  return "version" in source ? source.version.vars : [];
}

const layoutKeyOf = (source: FreeSource) => ("version" in source ? source.version.layout : source.layout.key);

/** 中身 → 定義(検査の前)。vars = テンプレートの埋め込み情報の値の zod(レイアウトを直に選んだ物は空)、varNames = 宣言の別名 */
export function templateDefinitionOf(
  source: FreeSource,
  category: string,
  values: Record<string, unknown>,
): AnyMessageDefinition {
  const declarations = templateVarsOf(source);
  const label = "version" in source ? `テンプレート ${source.version.templateKey}` : source.layout.label;
  const layout = layoutKeyOf(source);
  const vars = declarations.length > 0 ? varValuesSchema(declarations) : z.object({}).strict();
  const canonical = canonicalVarNames(values, declarations) as Record<string, unknown>;
  // vars の名前(定義に必須、D133)= 専用の宣言の別名と型の表示名
  const varNames = Object.fromEntries(
    declarations.map((declaration) => [declaration.key, { alias: declaration.alias, description: MESSAGE_VAR_TYPE_LABELS[declaration.type] }]),
  );
  return { key: TEMPLATE_MESSAGE_KEY, label, category, vars, varNames, layout, values: canonical } as unknown as AnyMessageDefinition;
}

/**
 * 自由連絡の中身を送れる定義にする(検査を通す。テキストの編集・fork の上書きは重ねない)。
 * @throws DomainError(400) カテゴリーの種別・絞り・欄・埋め込みの名前 / (500) カテゴリーが無い
 */
export function resolveTemplateDefinition(
  deps: {
    channels: Readonly<Record<string, MessageChannel>>;
    enrichers: Readonly<Record<string, MessageEnricher>>;
    categories: Readonly<Record<string, MessageCategory>>;
    layouts: Readonly<Record<string, MessageLayout>>;
  },
  input: { category: string; values: Record<string, unknown>; channels?: readonly string[]; source: FreeSource },
): AnyResolvedMessageDefinition {
  const { source } = input;
  const category = deps.categories[input.category];
  const label = "version" in source ? `テンプレート ${source.version.templateKey} の版 ${source.version.version}` : `レイアウト ${source.layout.key}`;
  if (!category) throw new DomainError(`${label} のカテゴリー ${input.category} がありません`, { status: 500 });
  if (!isAdminSendableKind(category.kind)) {
    throw new DomainError(
      `${label} はカテゴリー ${input.category}(種別 ${category.kind})では送れません(${adminSendableKinds().join("・")} のカテゴリーで送る)`,
      { status: 400 },
    );
  }
  const narrowing = input.channels ? [...new Set(input.channels)] : null;
  if (narrowing) {
    const outside = narrowing.filter((channel) => !category.channels.includes(channel));
    if (outside.length > 0 || narrowing.length === 0) {
      throw new DomainError(
        `送る送信方法 ${outside.join(", ") || "(空)"} はカテゴリー ${input.category} の送信方法(${category.channels.join(" / ")})の中の絞りにします`,
        { status: 400 },
      );
    }
  }
  const used = narrowing ? category.channels.filter((channel) => narrowing.includes(channel)) : [...category.channels];
  const narrowed = { ...category, channels: used };
  const message = { key: TEMPLATE_MESSAGE_KEY, category: input.category, kind: category.kind };

  // 埋め込み情報の一覧(共通 + 当たる enrichers + 専用)。名前の重なりと知らない名前は送る前に止める
  const catalog = varCatalog({ own: templateVarsOf(source), enrichers: enrichersFor(message, deps.enrichers) });
  const catalogProblems = checkVarCatalog(catalog);
  if (catalogProblems.length > 0) {
    throw new DomainError(`${label} を送れません: ${catalogProblems.map((problem) => problem.message).join(" / ")}`, { status: 400 });
  }
  // 空の任意の欄(画像の空文字・全部が空のボタン・空の並び)は「無い」(D128)。フォームは空の値のまま送ってくる
  const values = normalizedValues(deps.layouts, layoutKeyOf(source), input.values);
  const { unknown } = findVar(values, catalog);
  if (unknown.length > 0) {
    throw new DomainError(`${label} を送れません: ${unknown.map((name) => `{{${name}}}`).join(", ")} は埋め込み情報にありません`, { status: 400 });
  }

  const definition = templateDefinitionOf(source, input.category, values);
  const problems = validateMessageDefinition(definition, {
    categories: { [input.category]: narrowed },
    layouts: deps.layouts,
    channels: registeredChannelKeys(deps.channels),
    variableKeys: enricherKeysFor(message, deps.enrichers),
  });
  if (problems.length > 0) {
    throw new DomainError(`${label} を送れません: ${problems.map((problem) => problem.message).join(" / ")}`, { status: 400 });
  }
  return resolveMessageDefinition(definition, undefined, narrowed);
}
