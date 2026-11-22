// src/features/core/messaging/services/server/templates/checks.ts
//
// 保存されたテンプレートの保存時の検査(D41、指令 58)。作る・直すの前に同じ検査を通す。
// - カテゴリー: カテゴリーの受け口(categories)にあり、種別が announcement・direct・promotion(管理者が送れる種別。それ以外は 400)
// - レイアウト: レイアウトの受け口(layouts)にあり、管理者が選べる物(adminSelectable)
// - 欄の中身: そのカテゴリーの送信チャンネルで使う欄の zod(layoutValuesSchema)を通る
// - 専用の埋め込み情報: 宣言の zod(lib/messaging messageVarDeclarationSchema)を通り、一覧(共通 + テンプレートに当たる enrichers + 専用)の
//   鍵・別名が重ならない(checkVarCatalog、D126)。秘密の型は無い(型は lib の 6 つだけ。秘密はコードの定義の secretVar に置く)
// - 文面の {{鍵}} / {{別名}} は一覧の中だけ(findVar の unknown は 400)

import {
  checkVarCatalog,
  varCatalog,
  findVar,
  isLayoutAdminSelectable,
  isLayoutUsable,
  layoutValuesSchema,
  layoutVersionOf,
  messageVarDeclarationSchema,
  type MessageCategory,
  type MessageChannel,
  type MessageVarDeclaration,
  type MessageVarEntry,
  type MessageEnricher,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { isAdminSendableKind } from "../sendMessage/templateDefinition";

export type TemplateCheckDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  categories: Readonly<Record<string, MessageCategory>>;
  layouts: Readonly<Record<string, MessageLayout>>;
  /** テンプレートに当たる enrichers(管理者が送れる種別のどれで送っても当たる物。カテゴリーは送る時に選ぶ) */
  enrichers: readonly MessageEnricher[];
};

export type TemplateFields = {
  category: string;
  layout: string;
  values: Record<string, unknown>;
  vars: readonly unknown[];
};

export type CheckedTemplateFields = {
  layout: string;
  layoutVersion: number;
  values: Record<string, unknown>;
  vars: MessageVarDeclaration[];
};

/** テンプレートの埋め込み情報の一覧(共通 + テンプレートに当たる enrichers + 専用) */
export function templateVarCatalog(deps: TemplateCheckDeps, own: readonly MessageVarDeclaration[]): MessageVarEntry[] {
  return varCatalog({ own, enrichers: deps.enrichers });
}

/** 管理者が選べるレイアウト(使えて adminSelectable。無効のレイアウトは出さない) */
export function adminSelectableLayouts(deps: Pick<TemplateCheckDeps, "layouts">): MessageLayout[] {
  return Object.values(deps.layouts).filter(isLayoutAdminSelectable);
}

/**
 * テンプレートの中身を検査する。通れば形を整えた値を返す。
 * @throws DomainError(400) 問題の一覧を文にして
 */
export function checkTemplateFields(deps: TemplateCheckDeps, fields: TemplateFields): CheckedTemplateFields {
  const problems: string[] = [];
  const category = deps.categories[fields.category];
  if (!category) problems.push(`カテゴリー ${fields.category} はありません`);
  else if (!isAdminSendableKind(category.kind)) {
    problems.push(`カテゴリー ${fields.category}(種別 ${category.kind})はテンプレートに使えません(announcement・direct・promotion の種別のカテゴリー)`);
  }

  const layout = deps.layouts[fields.layout];
  let values: Record<string, unknown> = {};
  if (!layout) problems.push(`レイアウト ${fields.layout} はありません`);
  else if (!isLayoutUsable(layout)) problems.push(`レイアウト「${layout.label}」は使えません(無効)`);
  else if (!isLayoutAdminSelectable(layout)) problems.push(`レイアウト「${layout.label}」は管理者が選べるレイアウトではありません`);
  else {
    const channels = category ? category.channels.filter((key) => deps.channels[key]?.enabled !== false) : undefined;
    const parsed = layoutValuesSchema(layout, { channels }).safeParse(fields.values);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
      problems.push(`レイアウト「${layout.label}」の欄の中身が正しくありません(${detail})`);
    } else {
      values = parsed.data as Record<string, unknown>;
    }
  }

  const vars: MessageVarDeclaration[] = [];
  fields.vars.forEach((item, index) => {
    const parsed = messageVarDeclarationSchema.safeParse(item);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
      problems.push(`専用の埋め込み情報 ${index + 1} つ目の宣言が正しくありません(${detail})`);
    } else {
      vars.push(parsed.data as MessageVarDeclaration);
    }
  });

  const catalog = templateVarCatalog(deps, vars);
  for (const problem of checkVarCatalog(catalog)) problems.push(problem.message);
  const { unknown } = findVar(fields.values, catalog);
  if (unknown.length > 0) problems.push(`使えない埋め込み ${unknown.map((name) => `{{${name}}}`).join(", ")}`);

  if (problems.length > 0) throw new DomainError(`テンプレートの中身が正しくありません: ${problems.join(" / ")}`, { status: 400 });
  return { layout: fields.layout, layoutVersion: layoutVersionOf(layout!), values, vars };
}
