// src/features/core/messaging/services/server/templates/checks.ts
//
// 保存されたテンプレートの保存時の検査(D41)。作る・下書きの更新・公開の前に同じ検査を通す。
// - 文言: content の鍵は経路の受け口にあり有効(enabled: false でない)な経路の鍵、少なくとも 1 つ、各経路の欄の zod を通る(経路は持たない、D85)
// - 種類: 種類の受け口(categories)にあり、種別が announcement・direct・marketing(管理者が送れる種別。それ以外は 400)
// - 変数: MessageTemplateVariableSchema の並び、鍵は一意で {{鍵}} に使える形。共通の文脈・throttle の鍵・管理の定義 3 本(admin/freeText.ts)に当たる
//   provides と同じ鍵は不可。型 "secret" は不可(秘密はテンプレートを通さない: コードの定義の secretVar に置く)
// - 本文の {{鍵}} は 共通の文脈 ∪ 管理の定義 3 本(admin/freeText.ts)に当たる provides ∪ 宣言した変数 の中だけ

import { COMMON_CONTEXT_KEYS, THROTTLE_CONTEXT_KEYS, type MessageCategory, type MessageChannel } from "@/lib/messaging";
import { listVariables } from "@/lib/structuredDocument/shared";
import { DomainError } from "@/lib/errors";

import { MessageTemplateVariablesSchema, type MessageTemplateVariable } from "../../../entities/schema";
import { isAdminFreeTextKind } from "../admin/freeText";
import { activeChannel } from "../sendMessage/expand";

/** 変数の鍵の形({{鍵}} で書ける形) */
const VARIABLE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export type TemplateCheckDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  categories: Readonly<Record<string, MessageCategory>>;
  /** 管理の定義 3 本(admin/freeText.ts)に当たる enrichers の provides の鍵 */
  providedKeys: readonly string[];
};

export type TemplateFields = {
  category: string;
  content: Record<string, unknown>;
  variables: readonly unknown[];
};

/** 本文で使ってよい {{鍵}}(共通の文脈 ∪ provides ∪ 宣言した変数) */
export function templateAllowedKeys(deps: TemplateCheckDeps, variables: readonly { key: string }[]): string[] {
  return [...new Set([...COMMON_CONTEXT_KEYS, ...deps.providedKeys, ...variables.map((variable) => variable.key)])];
}

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * テンプレートの中身を検査する。通れば形を整えた値を返す。
 * @throws DomainError(400) 問題の一覧を文にして
 */
export function checkTemplateFields(
  deps: TemplateCheckDeps,
  fields: TemplateFields,
): { content: Record<string, unknown>; variables: MessageTemplateVariable[] } {
  const problems: string[] = [];
  const category = deps.categories[fields.category];
  if (!category) problems.push(`種類 ${fields.category} はありません`);
  else if (!isAdminFreeTextKind(category.kind)) {
    problems.push(`種類 ${fields.category}(種別 ${category.kind})はテンプレートに使えません(announcement・direct・marketing の種類)`);
  }

  const channels = Object.keys(fields.content).filter((key) => fields.content[key] !== undefined && fields.content[key] !== null);
  if (channels.length === 0) problems.push("少なくとも 1 つの経路に文言を書いてください");
  const content: Record<string, unknown> = {};
  for (const key of channels) {
    const channel = activeChannel(deps.channels, key);
    if (!channel) {
      problems.push(`経路 ${key} はありません`);
      continue;
    }
    const parsed = channel.fields.safeParse(fields.content[key]);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
      problems.push(`経路 ${key} の欄が正しくありません(${detail})`);
    } else {
      content[key] = parsed.data;
    }
  }

  const parsedVariables = MessageTemplateVariablesSchema.safeParse(fields.variables);
  const variables = parsedVariables.success ? parsedVariables.data : [];
  if (!parsedVariables.success) {
    problems.push("変数の宣言の形が正しくありません");
  } else {
    const reserved = new Set<string>([...COMMON_CONTEXT_KEYS, ...THROTTLE_CONTEXT_KEYS, ...deps.providedKeys]);
    const seen = new Set<string>();
    for (const variable of variables) {
      if (!VARIABLE_KEY.test(variable.key)) problems.push(`変数の鍵 ${variable.key} は英字で始まる英数字と _ にします`);
      if (seen.has(variable.key)) problems.push(`変数の鍵 ${variable.key} が重なっています`);
      seen.add(variable.key);
      if (reserved.has(variable.key)) problems.push(`変数の鍵 ${variable.key} は共通の値の名前なので使えません`);
      if (variable.type === "secret") problems.push(`変数 ${variable.key}: 秘密の値はテンプレートに宣言できません`);
    }
  }

  const allowed = new Set(templateAllowedKeys(deps, variables));
  const unknown = [...new Set(collectStrings(fields.content, []).flatMap((text) => listVariables(text)))].filter(
    (key) => !allowed.has(key),
  );
  if (unknown.length > 0) problems.push(`使えない差し込み ${unknown.map((key) => `{{${key}}}`).join(", ")}`);

  if (problems.length > 0) throw new DomainError(`テンプレートの中身が正しくありません: ${problems.join(" / ")}`, { status: 400 });
  return { content, variables };
}
