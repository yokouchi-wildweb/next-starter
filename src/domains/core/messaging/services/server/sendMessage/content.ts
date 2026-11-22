// src/domains/core/messaging/services/server/sendMessage/content.ts
//
// 送る口の中身の組み立て(1 つだけ、D124): 定義のレイアウトの欄の中身に差し込む → 送信チャンネルごとに描き方の 3 段(lib/messaging buildChannelContent:
// レイアウトの描き方 > 送信チャンネルの汎用 > 要約)→ 中身と見出し(要約の題)。どの段でも描けない送信チャンネルは送る前に止める(DomainError、送信チャンネルと理由)。
// 呼び手: 送信の見出し・全員同文の描画・その場の行・プレビュー・まとめ送りの描き直し・cron の共有のお知らせの行・cron の送る行・
// テキストの編集のプレビュー(どれも同じこの組み立てを通す)。
// - email: レイアウトにメールの描き方(layouts の受け口 layoutEmails)があればそれ、無ければ送信チャンネルの汎用、無ければ要約。送信チャンネルが送る時に描く
//   (rendersAtSend: 宛先ごとの停止のリンクを入れる)ので、中身は MessageLayoutContent
// - inApp: 送信チャンネルが送る時に行を書く(rendersAtSend)ので MessageLayoutContent + レイアウトの版 layoutVersion(行が要約の列とレイアウト・欄の中身を残す、指令 60)
// - line: 要約から
// - 静かなお知らせ(定義の silent): inApp の中身に silent: true を足す(行の metadata.silent になり、未読の数・未読のモーダルに入らない)
// - 差し込み: 表(鍵 → 値)に共通の埋め込み情報と当たる enrichers の日本語の別名の行を足す({{受信者名}} = {{recipientName}}、D126)。
//   テンプレートの専用の別名は送る口が送信に残す前に {{鍵}} へ書き換える(templateDefinition.ts)ので、ここでは要らない
// - 秘密の鍵(secretVar)は呼び手が差し込みの表から外す(見出し・全員同文の描画)。その場で送る行だけが秘密を差し込む

import {
  buildChannelContent,
  displayVarValues,
  varMap,
  isMessageLayoutContent,
  layoutVersionOf,
  type MessageChannel,
  type MessageEnricher,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import type { VariableMap } from "@/lib/templateVariables";

import { IN_APP_SILENT_CONTENT_KEY } from "../../../channels/inApp/createInAppChannel";

import { renderValue, toVariableMap } from "./context";
import type { AnyResolvedMessageDefinition } from "./definition";
import { messageVarCatalog } from "./enrichers";
import type { RecordPolicy } from "./record";

/** 組み立ての部品(送る口の deps の一部) */
export type MessageContentDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  /** レイアウトの受け口(server の一覧 layouts) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** 送信チャンネルの鍵 → レイアウトの描き方を持つレイアウトの鍵の表(email = layoutEmails。inApp の描き方は client の一覧なので S6 まで渡さない) */
  layoutRenderers: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** enrichers の受け口(別名の表に使う。無ければ共通の別名だけ) */
  enrichers?: Readonly<Record<string, MessageEnricher>>;
};

/** 送信チャンネル 1 つの組んだ中身 */
export type BuiltChannelContent = {
  /** 送信チャンネルへ渡す中身(ChannelSendTarget.content) */
  content: Record<string, unknown>;
  /** 件名・題(要約の題) */
  heading: string;
};

/** レイアウト(無ければコードの誤り) */
function layoutOf(deps: MessageContentDeps, resolved: AnyResolvedMessageDefinition): MessageLayout {
  const layout = deps.layouts[resolved.layout];
  if (!layout) {
    throw new DomainError(`連絡 ${resolved.key} のレイアウト ${resolved.layout} が layouts の受け口にありません`, { status: 500 });
  }
  return layout;
}

/**
 * 送信チャンネル 1 つの中身を組む(map = 差し込みの表)。
 * @throws DomainError(500) 描けない送信チャンネル(送信チャンネルが汎用の描き方も要約からの描き方も宣言していない = 組み合わせの誤り)
 */
export async function buildContent(
  deps: MessageContentDeps,
  resolved: AnyResolvedMessageDefinition,
  channelKey: string,
  map: VariableMap,
): Promise<BuiltChannelContent> {
  const layout = layoutOf(deps, resolved);
  const channel = deps.channels[channelKey];
  if (!channel) throw new DomainError(`送信方法 ${channelKey} は登録されていません(${resolved.key})`, { status: 500 });
  // 専用の日付・日時は人が読む字にし(型の印 <鍵>@type、残す値は ISO のまま)、共通・enrichers の別名の行を足す
  const named = varMap(displayVarValues(map), messageVarCatalog(resolved, deps.enrichers ?? {}));
  const values = renderValue(resolved.values ?? {}, named) as Record<string, unknown>;
  const result = await buildChannelContent({
    layout,
    channelKey,
    channel,
    hasLayoutRenderer: Boolean(deps.layoutRenderers[channelKey]?.[layout.key]),
    values,
  });
  if ("cannotRender" in result) {
    throw new DomainError(`連絡 ${resolved.key} を送れません: ${result.cannotRender}`, { status: 500 });
  }
  // 送信チャンネルが送る時に描く中身(MessageLayoutContent)にはレイアウトの版も付ける(お知らせの行が残す、指令 60)
  const content = isMessageLayoutContent(result.content) ? { ...result.content, layoutVersion: layoutVersionOf(layout) } : result.content;
  // 静かなお知らせ(定義の silent)はお知らせの中身に印を付ける(送信チャンネルが行の metadata.silent に写す)
  const silent = channelKey === IN_APP_CHANNEL && resolved.silent === true ? { [IN_APP_SILENT_CONTENT_KEY]: true } : {};
  return { content: { ...content, ...silent }, heading: result.title };
}

/** 送信チャンネルごとの中身(並びは channels の順) */
export async function buildContents(
  deps: MessageContentDeps,
  resolved: AnyResolvedMessageDefinition,
  channels: readonly string[],
  map: VariableMap,
): Promise<Record<string, BuiltChannelContent>> {
  const built: Record<string, BuiltChannelContent> = {};
  for (const key of channels) built[key] = await buildContent(deps, resolved, key, map);
  return built;
}

/**
 * 配達の行 1 つの中身。お知らせ(利用者が後から読む行)は秘密の値を空の字で差し込む(D130)。行は届けた中身で記録ではないので、
 * 記録の段・required に依らずレイアウト・版・欄の中身を残す(D120)。ほかの送信チャンネルは秘密も差し込む(その場で送る)
 */
export async function buildRowContent(
  deps: MessageContentDeps,
  resolved: AnyResolvedMessageDefinition,
  channel: string,
  values: Readonly<Record<string, unknown>>,
  policy: Pick<RecordPolicy, "secretKeys">,
) {
  if (channel !== IN_APP_CHANNEL) return buildContent(deps, resolved, channel, toVariableMap(values));
  const map = { ...toVariableMap(values), ...Object.fromEntries(policy.secretKeys.map((key) => [key, ""])) };
  return buildContent(deps, resolved, channel, map);
}

const IN_APP_CHANNEL = "inApp";
