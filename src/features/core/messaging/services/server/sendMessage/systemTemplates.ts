// src/features/core/messaging/services/server/sendMessage/systemTemplates.ts
//
// システムテンプレート(受け口 messaging/templates、D117・D125)の読み口と検査。
// - 管理者がその場で送れる種別(種別の性質 adminFreeText がある物)だけ、種別ごとに 1 つ、ひな形は受け口にある物
// - 送る口・管理の送信・テンプレートの一覧が読む。検査に通らない受け口は送る口が 500 で止める(黙って送らない)

import { kindTraits, kindsWhere, type MessageKind, type MessageLayout, type MessageSystemTemplate } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

/** 管理者がその場で送れる種別(種別の性質 adminFreeText がある物) */
export function adminSendableKinds(): MessageKind[] {
  return kindsWhere((traits) => traits.adminFreeText.length > 0);
}

/** 管理者がその場で送れる種別か */
export function isAdminSendableKind(kind: string | null | undefined): kind is MessageKind {
  return (kindTraits(kind)?.adminFreeText.length ?? 0) > 0;
}

/** 受け口の問題(空 = 通る) */
export function checkSystemTemplates(
  templates: Readonly<Record<string, MessageSystemTemplate>>,
  layouts: Readonly<Record<string, MessageLayout>>,
): string[] {
  const problems: string[] = [];
  const byKind = new Map<string, string>();
  for (const template of Object.values(templates)) {
    const label = `システムテンプレート ${template.key}`;
    if (!/^[a-z][A-Za-z0-9]*$/.test(template.key)) problems.push(`${label}: 鍵は英数字の camelCase で書く`);
    if (typeof template.label !== "string" || template.label.trim() === "") problems.push(`${label}: label(管理画面に出す名前)を書く`);
    if (!isAdminSendableKind(template.kind)) {
      problems.push(`${label}: 種別 ${template.kind} は管理者がその場で送れない(${adminSendableKinds().join(" / ")} のどれか)`);
    }
    const other = byKind.get(template.kind);
    if (other) problems.push(`${label}: 種別 ${template.kind} の白紙は ${other} がある(種別ごとに 1 つ)`);
    else byKind.set(template.kind, template.key);
    if (!layouts[template.layout]) problems.push(`${label}: ひな形 ${template.layout} は layouts の受け口に無い`);
    if (!template.values || typeof template.values !== "object" || Array.isArray(template.values)) {
      problems.push(`${label}: values(白紙の欄の中身)は object で書く`);
    }
  }
  return problems;
}

/**
 * 鍵のシステムテンプレート(受け口の検査を通した物)。
 * @throws DomainError(400) 無い鍵 / (500) 受け口の検査に通らない
 */
export function requireSystemTemplate(
  deps: { systemTemplates: Readonly<Record<string, MessageSystemTemplate>>; layouts: Readonly<Record<string, MessageLayout>> },
  key: string,
): MessageSystemTemplate {
  const problems = checkSystemTemplates(deps.systemTemplates, deps.layouts);
  if (problems.length > 0) throw new DomainError(`システムテンプレートの受け口が正しくありません: ${problems.join(" / ")}`, { status: 500 });
  const template = deps.systemTemplates[key];
  if (!template) throw new DomainError(`システムテンプレート ${key} はありません`, { status: 400 });
  return template;
}

/** 種別の白紙(無ければ null) */
export function systemTemplateOfKind(
  templates: Readonly<Record<string, MessageSystemTemplate>>,
  kind: string,
): MessageSystemTemplate | null {
  return Object.values(templates).find((template) => template.kind === kind) ?? null;
}
