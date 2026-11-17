// src/features/core/messaging/services/server/sendMessage/content.ts
//
// 送る口の中身の組み立て(1 つだけ、D124): 定義のひな形の欄の中身に差し込む → 経路ごとに描き方の 3 段(lib/messaging buildChannelContent:
// ひな形の描き方 > 経路の汎用 > 要約)→ 中身と見出し(要約の題)。どの段でも描けない経路は送る前に止める(DomainError、経路と理由)。
// 呼び手: 回の見出し・全員同文の描画・その場の行・プレビュー・まとめ送りの描き直し・cron の共有のお知らせの行・cron の送る行・
// 上書きのプレビュー(どれも同じこの組み立てを通す)。
// - email: ひな形にメールの描き方(layouts の受け口 layoutEmails)があればそれ、無ければ経路の汎用、無ければ要約。経路が送る時に描く
//   (rendersAtSend: 宛先ごとの停止のリンクを入れる)ので、中身は MessageLayoutContent
// - inApp: 経路が送る時に行を書く(rendersAtSend)ので MessageLayoutContent + ひな形の版 layoutVersion(行が要約の列とひな形・欄の中身を残す、指令 60)
// - line: 要約から
// - 差し込み: 表(鍵 → 値)に共通の埋め込み情報と当たる enrichers の日本語の別名の行を足す({{受信者名}} = {{recipientName}}、D126)。
//   テンプレートの専用の別名は送る口が回に残す前に {{鍵}} へ書き換える(templateDefinition.ts)ので、ここでは要らない
// - 秘密の鍵(secretVar)は呼び手が差し込みの表から外す(見出し・全員同文の描画)。その場で送る行だけが秘密を差し込む

import {
  buildChannelContent,
  displayEmbeddedValues,
  embeddedVariableMap,
  isMessageLayoutContent,
  layoutVersionOf,
  type MessageChannel,
  type MessageEnricher,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import type { VariableMap } from "@/lib/structuredDocument/shared";

import { inboxContentWithoutValues } from "../../../channels/inApp/createInAppChannel";

import { renderValue, toVariableMap } from "./context";
import type { AnyResolvedMessageDefinition } from "./definition";
import { messageEmbeddedCatalog } from "./enrichers";
import type { RecordPolicy } from "./record";

/** 組み立ての部品(送る口の deps の一部) */
export type MessageContentDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  /** ひな形の受け口(server の一覧 layouts) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** 経路の鍵 → ひな形の描き方を持つひな形の鍵の表(email = layoutEmails。inApp の描き方は client の一覧なので S6 まで渡さない) */
  layoutRenderers: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** enrichers の受け口(別名の表に使う。無ければ共通の別名だけ) */
  enrichers?: Readonly<Record<string, MessageEnricher>>;
};

/** 経路 1 つの組んだ中身 */
export type BuiltChannelContent = {
  /** 経路へ渡す中身(ChannelSendTarget.content) */
  content: Record<string, unknown>;
  /** 件名・題(要約の題) */
  heading: string;
};

/** ひな形(無ければコードの誤り) */
function layoutOf(deps: MessageContentDeps, resolved: AnyResolvedMessageDefinition): MessageLayout {
  const layout = deps.layouts[resolved.layout];
  if (!layout) {
    throw new DomainError(`連絡 ${resolved.key} のひな形 ${resolved.layout} が layouts の受け口にありません`, { status: 500 });
  }
  return layout;
}

/**
 * 経路 1 つの中身を組む(map = 差し込みの表)。
 * @throws DomainError(500) 描けない経路(経路が汎用の描き方も要約からの描き方も宣言していない = 組み合わせの誤り)
 */
export async function buildContent(
  deps: MessageContentDeps,
  resolved: AnyResolvedMessageDefinition,
  channelKey: string,
  map: VariableMap,
): Promise<BuiltChannelContent> {
  const layout = layoutOf(deps, resolved);
  const channel = deps.channels[channelKey];
  if (!channel) throw new DomainError(`経路 ${channelKey} は登録されていません(${resolved.key})`, { status: 500 });
  // 専用の日付・日時は人が読む字にし(型の印 <鍵>@type、残す値は ISO のまま)、共通・enrichers の別名の行を足す
  const named = embeddedVariableMap(displayEmbeddedValues(map), messageEmbeddedCatalog(resolved, deps.enrichers ?? {}));
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
  // 経路が送る時に描く中身(MessageLayoutContent)にはひな形の版も付ける(お知らせの行が残す、指令 60)
  const content = isMessageLayoutContent(result.content) ? { ...result.content, layoutVersion: layoutVersionOf(layout) } : result.content;
  return { content, heading: result.title };
}

/** 経路ごとの中身(並びは channels の順) */
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
 * 配達の行 1 つの中身。お知らせ(利用者が後から読む行)は秘密の値を空の字で差し込み(D130)、記録の段が meta・秘密の連絡は欄の中身を残さない
 * (行は要約だけ、指令 60)。ほかの経路は秘密も差し込む(その場で送る)
 */
export async function buildRowContent(
  deps: MessageContentDeps,
  resolved: AnyResolvedMessageDefinition,
  channel: string,
  values: Readonly<Record<string, unknown>>,
  policy: Pick<RecordPolicy, "secretKeys" | "keepRendered">,
) {
  if (channel !== IN_APP_CHANNEL) return buildContent(deps, resolved, channel, toVariableMap(values));
  const map = { ...toVariableMap(values), ...Object.fromEntries(policy.secretKeys.map((key) => [key, ""])) };
  const built = await buildContent(deps, resolved, channel, map);
  return policy.keepRendered ? built : { ...built, content: inboxContentWithoutValues(built.content) };
}

const IN_APP_CHANNEL = "inApp";
