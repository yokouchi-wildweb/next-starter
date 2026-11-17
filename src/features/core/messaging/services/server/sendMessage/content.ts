// src/features/core/messaging/services/server/sendMessage/content.ts
//
// 送る口の中身の組み立て(1 つだけ、D124): 定義のひな形の欄の中身に差し込む → 経路ごとに描き方の 3 段(lib/messaging buildChannelContent:
// ひな形の描き方 > 経路の汎用 > 要約)→ 中身と見出し(要約の題)。どの段でも描けない経路は送る前に止める(DomainError、経路と理由)。
// 呼び手: 回の見出し・全員同文の描画・その場の行・プレビュー・まとめ送りの描き直し・cron の共有のお知らせの行・cron の送る行・
// 上書きのプレビュー(どれも同じこの組み立てを通す)。
// - email: ひな形にメールの描き方(layouts の受け口 layoutEmails)があればそれ、無ければ経路の汎用、無ければ要約。経路が送る時に描く
//   (rendersAtSend: 宛先ごとの停止のリンクを入れる)ので、中身は MessageLayoutContent
// - inApp・line: 要約から(inApp の行は S6 まで今の title・body・image・link に要約を入れる)
// - 秘密の鍵(secretVar)は呼び手が差し込みの表から外す(見出し・全員同文の描画)。その場で送る行だけが秘密を差し込む

import {
  buildChannelContent,
  type MessageChannel,
  type MessageLayout,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";
import type { VariableMap } from "@/lib/structuredDocument/shared";

import { renderValue } from "./context";
import type { AnyResolvedMessageDefinition } from "./definition";

/** 組み立ての部品(送る口の deps の一部) */
export type MessageContentDeps = {
  channels: Readonly<Record<string, MessageChannel>>;
  /** ひな形の受け口(server の一覧 layouts) */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** 経路の鍵 → ひな形の描き方を持つひな形の鍵の表(email = layoutEmails。inApp の描き方は client の一覧なので S6 まで渡さない) */
  layoutRenderers: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
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
  const values = renderValue(resolved.values ?? {}, map) as Record<string, unknown>;
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
  return { content: result.content, heading: result.title };
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
