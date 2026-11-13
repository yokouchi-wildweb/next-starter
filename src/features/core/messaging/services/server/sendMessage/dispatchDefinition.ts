// src/features/core/messaging/services/server/sendMessage/dispatchDefinition.ts
//
// cron(展開・送信)が回から送る定義を引き直す 1 か所。
// - テンプレートの回(template_version がある): 固定した版から組み直す(最新を引き直さない)。直して送った回(template_edited)は
//   回に残した文言(template_content)と版の変数の宣言で組む。経路は回の経路(送った時の絞り)。回の vars をもう一度版の zod に通す
//   (D41 の送る時の再検査)。版が無い・テンプレートが消えた・値が合わない → 誤りの符号を返す(送らずに止める)
// - それ以外: 生成の一覧の定義(message_key)に上書きを重ねる(resolveDefinition)
// - 種類は回に残した種類(送った時の分類のまま、D81。管理の送信の仮の種類 operatorDirect もこれで保たれる)

import type { MessageDispatch } from "../../../entities/model";
import { parseVars } from "./context";
import { resolveDefinition, type AnyResolvedMessageDefinition } from "./definition";
import { resolveTemplateDefinition } from "./templateDefinition";
import type { MessageSendDeps } from "./types";

export type DispatchDefinitionError =
  | "definition_missing"
  | "template_missing"
  | "template_invalid"
  | "template_vars_invalid";

/**
 * 回の定義。
 * @throws DomainError(500) 生成の一覧の定義・上書きの誤り(呼び手が definition_invalid にする)
 */
export async function definitionOfDispatch(
  deps: MessageSendDeps,
  dispatch: Pick<
    MessageDispatch,
    "message_key" | "template_id" | "template_version" | "template_edited" | "template_content" | "category" | "vars" | "channels"
  >,
): Promise<{ resolved: AnyResolvedMessageDefinition } | { error: DispatchDefinitionError }> {
  if (dispatch.template_version !== null && dispatch.template_version !== undefined) {
    if (!dispatch.template_id || !deps.templates) return { error: "template_missing" };
    const version = await deps.templates.loadVersion(dispatch.template_id, dispatch.template_version);
    if (!version) return { error: "template_missing" };
    let resolved: AnyResolvedMessageDefinition;
    try {
      if (dispatch.template_edited && !dispatch.template_content) return { error: "template_invalid" };
      resolved = resolveTemplateDefinition(version, deps, {
        category: dispatch.category ?? undefined,
        channels: dispatch.channels && dispatch.channels.length > 0 ? dispatch.channels : undefined,
        content: dispatch.template_edited ? (dispatch.template_content ?? undefined) : undefined,
      });
    } catch {
      return { error: "template_invalid" };
    }
    try {
      parseVars(resolved, (dispatch.vars ?? {}) as Record<string, unknown>);
    } catch {
      return { error: "template_vars_invalid" };
    }
    return { resolved };
  }
  const entry = dispatch.message_key ? deps.registry[dispatch.message_key] : undefined;
  if (!entry) return { error: "definition_missing" };
  const { message } = await entry.definition();
  // 回の種類が今の受け口に無ければ(fork が種類を消した)定義の種類で組み直す
  const category = dispatch.category && deps.categories[dispatch.category] ? dispatch.category : undefined;
  return { resolved: await resolveDefinition(message, deps, category ? { category } : {}) };
}
