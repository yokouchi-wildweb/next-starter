// src/features/core/messaging/services/server/sendMessage/systemTemplates.ts
//
// システムテンプレート(受け口 messaging/templates、D117・D125)の読み口と検査。
// - 管理者がその場で送れる種別(種別の性質 adminFreeText がある物)だけ、ひな形は受け口にある物。1 つの種別に何本でも置け、
//   受け口の順で使う物の最初がその種別の既定の白紙(D119)
// - enabled: false(fork の override、D122)の物はどこにも出さない(一覧・送る画面の選択肢・既定の白紙)、その鍵では送れない(無い鍵と同じ)。
//   送れる種別ごとに使う物が 1 本は要る(無ければ検査で止める)
// - 専用の埋め込み情報の宣言(任意)は DB のテンプレートと同じ検査(宣言の形・共通の名前との重なり)
// - 送る口・管理の送信・テンプレートの一覧が読む。検査に通らない受け口は送る口が 500 で止める(黙って送らない)

import {
  checkEmbeddedCatalog,
  embeddedCatalog,
  kindTraits,
  kindsWhere,
  messageEmbeddedDeclarationSchema,
  type MessageEmbeddedDeclaration,
  type MessageKind,
  type MessageLayout,
  type MessageSystemTemplate,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

/** 管理者がその場で送れる種別(種別の性質 adminFreeText がある物) */
export function adminSendableKinds(): MessageKind[] {
  return kindsWhere((traits) => traits.adminFreeText.length > 0);
}

/** 管理者がその場で送れる種別か */
export function isAdminSendableKind(kind: string | null | undefined): kind is MessageKind {
  return (kindTraits(kind)?.adminFreeText.length ?? 0) > 0;
}

/** 使うシステムテンプレートか(enabled: false で切った物は使わない) */
export function isSystemTemplateEnabled(template: Pick<MessageSystemTemplate, "enabled">): boolean {
  return template.enabled !== false;
}

/** 使うシステムテンプレートだけ(受け口の順) */
export function enabledSystemTemplates(templates: Readonly<Record<string, MessageSystemTemplate>>): MessageSystemTemplate[] {
  return Object.values(templates).filter(isSystemTemplateEnabled);
}

/** 受け口の問題(空 = 通る) */
export function checkSystemTemplates(
  templates: Readonly<Record<string, MessageSystemTemplate>>,
  layouts: Readonly<Record<string, MessageLayout>>,
): string[] {
  const problems: string[] = [];
  for (const template of Object.values(templates)) {
    const label = `システムテンプレート ${template.key}`;
    if (!/^[a-z][A-Za-z0-9]*$/.test(template.key)) problems.push(`${label}: 鍵は英数字の camelCase で書く`);
    if (typeof template.label !== "string" || template.label.trim() === "") problems.push(`${label}: label(管理画面に出す名前)を書く`);
    if (template.enabled !== undefined && typeof template.enabled !== "boolean") problems.push(`${label}: enabled は true / false で書く`);
    if (!isAdminSendableKind(template.kind)) {
      problems.push(`${label}: 種別 ${template.kind} は管理者がその場で送れない(${adminSendableKinds().join(" / ")} のどれか)`);
    }
    const declarations: MessageEmbeddedDeclaration[] = [];
    for (const item of template.embedded ?? []) {
      const parsed = messageEmbeddedDeclarationSchema.safeParse(item);
      if (parsed.success) declarations.push(parsed.data as MessageEmbeddedDeclaration);
      else problems.push(`${label}: 専用の埋め込み情報 ${String((item as { key?: unknown }).key)} の宣言が正しくない`);
    }
    for (const problem of checkEmbeddedCatalog(embeddedCatalog({ own: declarations }))) problems.push(`${label}: ${problem.message}`);
    if (!layouts[template.layout]) problems.push(`${label}: ひな形 ${template.layout} は layouts の受け口に無い`);
    if (!template.values || typeof template.values !== "object" || Array.isArray(template.values)) {
      problems.push(`${label}: values(白紙の欄の中身)は object で書く`);
    }
  }
  // 送れる種別ごとに使う物が 1 本は要る(種別の既定の白紙。全部を切ると送る画面がその種別で書けない)
  const enabled = enabledSystemTemplates(templates);
  for (const kind of adminSendableKinds()) {
    if (!enabled.some((template) => template.kind === kind)) {
      problems.push(`種別 ${kind} の使うシステムテンプレートが 1 本も無い(enabled: false で全部を切らない)`);
    }
  }
  return problems;
}

/**
 * 鍵のシステムテンプレート(受け口の検査を通した物)。
 * @throws DomainError(400) 無い鍵・切った鍵 / (500) 受け口の検査に通らない
 */
export function requireSystemTemplate(
  deps: { systemTemplates: Readonly<Record<string, MessageSystemTemplate>>; layouts: Readonly<Record<string, MessageLayout>> },
  key: string,
): MessageSystemTemplate {
  const problems = checkSystemTemplates(deps.systemTemplates, deps.layouts);
  if (problems.length > 0) throw new DomainError(`システムテンプレートの受け口が正しくありません: ${problems.join(" / ")}`, { status: 500 });
  const template = deps.systemTemplates[key];
  if (!template || !isSystemTemplateEnabled(template)) throw new DomainError(`システムテンプレート ${key} はありません`, { status: 400 });
  return template;
}

/** 種別の既定の白紙(受け口の順でその種別の使う物の最初。無ければ null) */
export function systemTemplateOfKind(
  templates: Readonly<Record<string, MessageSystemTemplate>>,
  kind: string,
): MessageSystemTemplate | null {
  return enabledSystemTemplates(templates).find((template) => template.kind === kind) ?? null;
}
