// src/features/core/messaging/services/server/templates/checks.ts
//
// 保存されたテンプレートの保存時の検査(D41、指令 58)。作る・直すの前に同じ検査を通す。
// - 種類: 種類の受け口(categories)にあり、種別が announcement・direct・promotion(管理者が送れる種別。それ以外は 400)
// - ひな形: ひな形の受け口(layouts)にあり、管理者が選べる物(adminSelectable)
// - 欄の中身: そのカテゴリーの経路で使う欄の zod(layoutValuesSchema)を通る
// - 専用の埋め込み情報: 宣言の zod(lib/messaging messageEmbeddedDeclarationSchema)を通り、一覧(共通 + テンプレートに当たる enrichers + 専用)の
//   鍵・別名が重ならない(checkEmbeddedCatalog、D126)。秘密の型は無い(型は lib の 6 つだけ。秘密はコードの定義の secretVar に置く)
// - 文面の {{鍵}} / {{別名}} は一覧の中だけ(findEmbedded の unknown は 400)

import {
  checkEmbeddedCatalog,
  embeddedCatalog,
  findEmbedded,
  layoutValuesSchema,
  layoutVersionOf,
  messageEmbeddedDeclarationSchema,
  type MessageCategory,
  type MessageChannel,
  type MessageEmbeddedDeclaration,
  type MessageEmbeddedEntry,
  type MessageEnricher,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { isAdminSendableKind } from "../sendMessage/systemTemplates";

export type TemplateCheckDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  categories: Readonly<Record<string, MessageCategory>>;
  layouts: Readonly<Record<string, MessageLayout>>;
  /** テンプレートに当たる enrichers(管理者が送れる種別のどれで送っても当たる物。種類は送る時に選ぶ) */
  enrichers: readonly MessageEnricher[];
};

export type TemplateFields = {
  category: string;
  layout: string;
  values: Record<string, unknown>;
  embedded: readonly unknown[];
};

export type CheckedTemplateFields = {
  layout: string;
  layoutVersion: number;
  values: Record<string, unknown>;
  embedded: MessageEmbeddedDeclaration[];
};

/** テンプレートの埋め込み情報の一覧(共通 + テンプレートに当たる enrichers + 専用) */
export function templateEmbeddedCatalog(deps: TemplateCheckDeps, own: readonly MessageEmbeddedDeclaration[]): MessageEmbeddedEntry[] {
  return embeddedCatalog({ own, enrichers: deps.enrichers });
}

/** 管理者が選べるひな形 */
export function adminSelectableLayouts(deps: Pick<TemplateCheckDeps, "layouts">): MessageLayout[] {
  return Object.values(deps.layouts).filter((layout) => layout.adminSelectable === true);
}

/**
 * テンプレートの中身を検査する。通れば形を整えた値を返す。
 * @throws DomainError(400) 問題の一覧を文にして
 */
export function checkTemplateFields(deps: TemplateCheckDeps, fields: TemplateFields): CheckedTemplateFields {
  const problems: string[] = [];
  const category = deps.categories[fields.category];
  if (!category) problems.push(`種類 ${fields.category} はありません`);
  else if (!isAdminSendableKind(category.kind)) {
    problems.push(`種類 ${fields.category}(種別 ${category.kind})はテンプレートに使えません(announcement・direct・promotion の種類)`);
  }

  const layout = deps.layouts[fields.layout];
  let values: Record<string, unknown> = {};
  if (!layout) problems.push(`ひな形 ${fields.layout} はありません`);
  else if (layout.adminSelectable !== true) problems.push(`ひな形「${layout.label}」は管理者が選べるひな形ではありません`);
  else {
    const channels = category ? category.channels.filter((key) => deps.channels[key]?.enabled !== false) : undefined;
    const parsed = layoutValuesSchema(layout, { channels }).safeParse(fields.values);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
      problems.push(`ひな形「${layout.label}」の欄の中身が正しくありません(${detail})`);
    } else {
      values = parsed.data as Record<string, unknown>;
    }
  }

  const embedded: MessageEmbeddedDeclaration[] = [];
  fields.embedded.forEach((item, index) => {
    const parsed = messageEmbeddedDeclarationSchema.safeParse(item);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`).join(" / ");
      problems.push(`専用の埋め込み情報 ${index + 1} つ目の宣言が正しくありません(${detail})`);
    } else {
      embedded.push(parsed.data as MessageEmbeddedDeclaration);
    }
  });

  const catalog = templateEmbeddedCatalog(deps, embedded);
  for (const problem of checkEmbeddedCatalog(catalog)) problems.push(problem.message);
  const { unknown } = findEmbedded(fields.values, catalog);
  if (unknown.length > 0) problems.push(`使えない埋め込み ${unknown.map((name) => `{{${name}}}`).join(", ")}`);

  if (problems.length > 0) throw new DomainError(`テンプレートの中身が正しくありません: ${problems.join(" / ")}`, { status: 400 });
  return { layout: fields.layout, layoutVersion: layoutVersionOf(layout!), values, embedded };
}
