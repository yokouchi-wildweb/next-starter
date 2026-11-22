// src/lib/messaging/layout/content.ts
//
// 送信チャンネル 1 つの中身の組み立て(D124・D125): 差し込みを済ませた欄の中身 → その送信チャンネルが使う欄だけ → 要約 → 描き方の 3 段(resolveRendering)→ 中身。
// - 送る時に描く送信チャンネル(rendersAtSend、例 email = 宛先ごとの停止のリンクを入れて描く)と、レイアウトの描き方で描く送信チャンネルには
//   MessageLayoutContent(題・レイアウト・段・欄の中身・要約)を渡し、送信チャンネルが送る時に描く
// - それ以外の送信チャンネルは汎用の描き方か要約から描いた物を中身にする(content があればそれ、無ければ html / text)
// - どの段でも描けない・要約を作れない → { cannotRender: 理由 }(呼び手が送る前に止める)
// 送る口の組み立て(domains/messaging の sendMessage/content.ts)がこの関数を送信チャンネルごとに呼ぶ。純粋な関数(差し込みは呼び手)。

import type { ChannelRendered } from "../receptacles/types";
import { resolveRendering, type MessageChannelRendering } from "./rendering";
import type { MessageLayout, MessageLayoutSummary, MessageLayoutValues } from "./types";
import { fieldsForChannel } from "./values";

/** 送る時に描く送信チャンネル・レイアウトの描き方で描く送信チャンネルへ渡す中身 */
export type MessageLayoutContent = {
  /** 件名・題(要約の題。送信の見出しにも使う) */
  title: string;
  /** レイアウトの鍵 */
  layout: string;
  /** 描き方の段(layout = レイアウトの描き方 / channel = 送信チャンネルの汎用 / summary = 要約から) */
  from: "layout" | "channel" | "summary";
  /** その送信チャンネルが使う欄だけの中身(差し込み済み) */
  values: MessageLayoutValues;
  summary: MessageLayoutSummary;
};

/** 送信チャンネル 1 つの組み立ての結果 */
export type MessageChannelContentResult =
  | { content: Record<string, unknown>; title: string }
  | { cannotRender: string };

/** 中身が MessageLayoutContent か(送信チャンネルが送る時に描き分けるのに使う) */
export function isMessageLayoutContent(value: unknown): value is MessageLayoutContent {
  if (!value || typeof value !== "object") return false;
  const content = value as Record<string, unknown>;
  return (
    typeof content.layout === "string" &&
    (content.from === "layout" || content.from === "channel" || content.from === "summary") &&
    typeof content.values === "object" &&
    typeof content.summary === "object"
  );
}

function renderedContent(rendered: ChannelRendered): Record<string, unknown> {
  if (rendered.content) return { ...rendered.content };
  return {
    ...(rendered.html !== undefined ? { html: rendered.html } : {}),
    ...(rendered.text !== undefined ? { text: rendered.text } : {}),
  };
}

/**
 * 送信チャンネル 1 つの中身を組む。values = レイアウトの欄の中身(差し込み済み、全部の欄)。
 * hasLayoutRenderer = レイアウトのフォルダがこの送信チャンネルの描き方を持つ(送る口が受け口の生成の一覧から知る)
 */
export async function buildChannelContent(input: {
  layout: MessageLayout;
  channelKey: string;
  channel: MessageChannelRendering<ChannelRendered> & { rendersAtSend?: boolean };
  hasLayoutRenderer: boolean;
  values: Readonly<Record<string, unknown>>;
}): Promise<MessageChannelContentResult> {
  const { layout, channelKey, channel } = input;
  // その送信チャンネルが使う欄だけ(送信チャンネルだけの欄を他の送信チャンネルに出さない、D125)
  const keys = Object.keys(fieldsForChannel(layout, channelKey));
  const values = Object.fromEntries(
    keys.filter((key) => input.values[key] !== undefined).map((key) => [key, input.values[key]]),
  ) as MessageLayoutValues;
  let summary: MessageLayoutSummary;
  try {
    summary = layout.summary(values);
  } catch (error) {
    return {
      cannotRender: `送信方法 ${channelKey}: レイアウト「${layout.label}」の要約を作れません(${error instanceof Error ? error.message : String(error)})`,
    };
  }
  const resolution = resolveRendering({ layout, channelKey, hasLayoutRenderer: input.hasLayoutRenderer, channel, values });
  if ("cannotRender" in resolution) return { cannotRender: resolution.cannotRender };
  const title = summary.title;
  if (resolution.from === "layout" || channel.rendersAtSend) {
    const content: MessageLayoutContent = { title, layout: layout.key, from: resolution.from, values, summary };
    return { content: content as unknown as Record<string, unknown>, title };
  }
  if (resolution.from === "channel") {
    return { content: renderedContent(await channel.renderGeneric!({ fields: resolution.fields, values })), title };
  }
  return { content: renderedContent(await channel.renderFromSummary!(summary)), title };
}
