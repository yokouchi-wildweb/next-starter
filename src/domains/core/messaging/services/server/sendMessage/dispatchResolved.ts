// src/domains/core/messaging/services/server/sendMessage/dispatchResolved.ts
//
// 送信から描くための定義を組む 1 か所(D128)。cron(展開・送信)・管理の操作(失敗の再送・操作の可否)が使う。
// - 描く物は送信だけから: レイアウトの鍵と版・欄の中身(values、差し込む前)・カテゴリー・種別・送信チャンネル・記録の段。定義・テンプレートを引き直さない
//   (送った後に定義・テンプレート・テキストの編集を直しても、予約・後回しの送信の中身は変わらない)
// - 送った版から今の版へレイアウトの改版の対応で読み替える。読めない版・レイアウトが無い = 誤りの符号(送らずに止める)
// - 送信の values が無い(record meta で閉じた送信・required と秘密の連絡)は組めるが values は空。描く呼び手(cron)は values_missing で止める
// - 描かない振る舞いはコードの定義(message_key の生成の一覧の定義 + fork の上書き)から読む: 間引き(throttle)・required・静かなお知らせ(silent)・
//   vars の zod(秘密の印)。定義が無ければ間引かず、required でも静かでも秘密でもない扱い(ANSWERS Q1)

import { z } from "zod";

import {
  applyMessageOverride,
  isMessageKind,
  upgradeLayoutValues,
  type MessageKey,
  type MessageKind,
} from "@/lib/messaging";

import type { MessageDispatch } from "../../../entities/model";
import type { AnyMessageDefinition, AnyResolvedMessageDefinition } from "./definition";
import { TEMPLATE_MESSAGE_KEY } from "./templateDefinition";
import type { MessageSendDeps } from "./types";

export type DispatchResolveError = "layout_missing" | "layout_unreadable";

export type DispatchSource = Pick<
  MessageDispatch,
  "message_key" | "category" | "kind" | "channels" | "record" | "layout" | "layout_version" | "values"
>;

/** 描かない振る舞いのためのコードの定義(無ければ null) */
async function codeDefinition(deps: Pick<MessageSendDeps, "registry">, messageKey: string | null): Promise<AnyMessageDefinition | null> {
  const entry = messageKey ? deps.registry[messageKey] : undefined;
  if (!entry) return null;
  const { message } = await entry.definition();
  if (!message) return null;
  const override = entry.override ? (await entry.override()).messageOverride : undefined;
  return applyMessageOverride(message, override) as AnyMessageDefinition;
}

/**
 * 送信から描くための定義。
 * @returns 誤りの符号 layout_missing(送信のレイアウトが受け口に無い)/ layout_unreadable(送った版から今の版へ読み替えられない)
 */
export async function resolvedOfDispatch(
  deps: Pick<MessageSendDeps, "registry" | "layouts" | "categories">,
  dispatch: DispatchSource,
): Promise<{ resolved: AnyResolvedMessageDefinition } | { error: DispatchResolveError }> {
  const layout = dispatch.layout ? deps.layouts[dispatch.layout] : undefined;
  if (!layout) return { error: "layout_missing" };
  let values: Record<string, unknown> = {};
  if (dispatch.values) {
    const upgraded = upgradeLayoutValues(layout, dispatch.values, dispatch.layout_version ?? 1);
    if ("cannotRender" in upgraded) return { error: "layout_unreadable" };
    values = upgraded.values;
  }
  const code = await codeDefinition(deps, dispatch.message_key ?? null);
  const category = dispatch.category ?? code?.category ?? "";
  const kind: MessageKind =
    dispatch.kind && isMessageKind(dispatch.kind) ? dispatch.kind : (deps.categories[category]?.kind ?? "transactional");
  const resolved = {
    key: (dispatch.message_key ?? TEMPLATE_MESSAGE_KEY) as MessageKey,
    label: code?.label ?? "",
    category,
    kind,
    channels: [...(dispatch.channels ?? [])],
    layout: layout.key,
    values,
    // 振る舞い(描かない物)だけコードの定義から。テンプレートからの送信(message_key null)はコードの定義が無いので、送信の vars はそのまま差し込む
    vars: code ? code.vars : z.object({}).passthrough(),
    // vars の別名(D133): 組み直しでも {{別名}} を鍵と同じ値で埋める(テンプレートの専用の別名は送る時に鍵へ書き換え済み)
    varNames: code?.varNames ?? {},
    ...(code?.required ? { required: true as const } : {}),
    ...(code?.throttle ? { throttle: code.throttle } : {}),
    ...(code?.silent ? { silent: true } : {}),
    ...(dispatch.record ? { record: dispatch.record } : code?.record ? { record: code.record } : {}),
    enabled: true,
  } as unknown as AnyResolvedMessageDefinition;
  return { resolved };
}
