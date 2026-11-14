// src/features/core/messaging/services/server/sendMessage/dispatchDefinition.ts
//
// cron(展開・送信)・管理の操作が回から送る定義を引き直す 1 か所。
// - 書いた文面の回(authored_content がある、D92): その文面で組む(送る時と同じ resolveAuthoredDefinition)。テンプレートを呼び出した回
//   (template_version がある)は固定した版の変数の宣言で vars を検査する(最新を引き直さない)。経路は回の経路(送った時の絞り)。
//   回の vars をもう一度 zod に通す(D41 の送る時の再検査)。版が無い・テンプレートが消えた・値が合わない → 誤りの符号を返す(送らずに止める)
// - 書いた文面の無いテンプレートの回(この列より前に版のまま送った回): 版の文面で組む
// - それ以外: 生成の一覧の定義(message_key)に上書きを重ねる(resolveDefinition)。authored の定義なのに文面が無い回(この列より前の
//   その場で書いた回)は組めないので authored_missing(送らずに止める)
// - 種類は回に残した種類(送った時の分類のまま、D81)

import type { MessageDispatch } from "../../../entities/model";
import { resolveAuthoredDefinition } from "./authoredDefinition";
import { parseVars } from "./context";
import { resolveDefinition, type AnyResolvedMessageDefinition } from "./definition";
import type { MessageSendDeps, MessageTemplateVersionSource } from "./types";

export type DispatchDefinitionError =
  | "definition_missing"
  | "authored_missing"
  | "template_missing"
  | "template_invalid"
  | "template_vars_invalid";

/**
 * 回の定義。
 * @throws DomainError(500) 生成の一覧の定義・上書きの誤り(呼び手が definition_invalid にする)
 */
export async function definitionOfDispatch(
  deps: MessageSendDeps,
  dispatch: Pick<MessageDispatch, "message_key" | "template_id" | "template_version" | "authored_content" | "category" | "vars" | "channels">,
): Promise<{ resolved: AnyResolvedMessageDefinition } | { error: DispatchDefinitionError }> {
  const pinned = dispatch.template_version !== null && dispatch.template_version !== undefined;
  if (dispatch.authored_content || pinned) {
    let version: MessageTemplateVersionSource | undefined;
    if (pinned) {
      if (!dispatch.template_id || !deps.templates) return { error: "template_missing" };
      version = (await deps.templates.loadVersion(dispatch.template_id, dispatch.template_version!)) ?? undefined;
      if (!version) return { error: "template_missing" };
    }
    const content = dispatch.authored_content ?? version?.content;
    if (!content || !dispatch.category) return { error: "template_invalid" };
    let resolved: AnyResolvedMessageDefinition;
    try {
      resolved = resolveAuthoredDefinition(deps, {
        category: dispatch.category,
        content,
        channels: dispatch.channels && dispatch.channels.length > 0 ? dispatch.channels : undefined,
        version,
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
  if ((message as { authored?: true }).authored) return { error: "authored_missing" };
  // 回の種類が今の受け口に無ければ(fork が種類を消した)定義の種類で組み直す
  const category = dispatch.category && deps.categories[dispatch.category] ? dispatch.category : undefined;
  return { resolved: await resolveDefinition(message, deps, category ? { category } : {}) };
}
