// src/lib/messaging/layout/rendering.ts
//
// 描き方の 3 段(D124): レイアウトのその送信チャンネルの描き方 > 送信チャンネルの汎用の描き方 > 要約。どれでも描けなければ「描けない(理由)」。
// テンプレートの保存・プレビュー・送る前の検査がこの解決を呼んで止める。送信チャンネルの項目への宣言の追加は別の作業(ここは型と解決だけ)。

import type { MessageLayout, MessageLayoutFields, MessageLayoutSummary, MessageLayoutValues } from "./types";
import { fieldsForChannel } from "./values";
import type { MessageFieldShape, MessageFieldType } from "./vocabulary";

/** 送信チャンネルが持てる描き方の宣言(R = 送信チャンネルが描いた物。email = HTML など) */
export type MessageChannelRendering<R = unknown> = {
  /** 欄の型とブロックの語彙を宣言の順に描く汎用の描き方 */
  renderGeneric?: (input: { fields: MessageLayoutFields; values: MessageLayoutValues }) => R | Promise<R>;
  /** 汎用の描き方が描ける欄の型(無い = 全部) */
  genericFieldTypes?: readonly MessageFieldType[];
  /** 要約から描ける(D124 の宣言)。true なら renderFromSummary が要る */
  summaryRenderable?: boolean;
  renderFromSummary?: (summary: MessageLayoutSummary) => R | Promise<R>;
  /**
   * 送る時に宛先ごとに描く(例 email = 宛先ごとの停止のリンクを本文に入れる)。true なら送る口は描かずに MessageLayoutContent
   * (題・レイアウト・段・欄の中身・要約)を中身として渡し、送信チャンネルが段に従って描く(./content.ts)
   */
  rendersAtSend?: boolean;
};

export type MessageRenderingResolution =
  | { from: "layout" }
  | { from: "channel"; fields: MessageLayoutFields }
  | { from: "summary"; summary: MessageLayoutSummary }
  | { cannotRender: string };

/** 欄の宣言が使う型(並び・組の中も) */
function typesOf(shape: MessageFieldShape, out: Set<MessageFieldType>): Set<MessageFieldType> {
  out.add(shape.type);
  if (shape.type === "list") typesOf(shape.of, out);
  if (shape.type === "group") for (const child of Object.values(shape.fields)) typesOf(child, out);
  return out;
}

/**
 * 描き方を決める(D124 の順)。
 * - hasLayoutRenderer: レイアウトのフォルダがこの送信チャンネルの描き方を持つか(受け口の生成の一覧が知っている)
 * - 汎用は送信チャンネルの欄の型を全部描ける時だけ
 * - 要約は送信チャンネルが summaryRenderable を宣言し renderFromSummary を持つ時だけ(要約の関数が投げれば描けない)
 */
export function resolveRendering(input: {
  layout: MessageLayout;
  channelKey: string;
  hasLayoutRenderer: boolean;
  channel: MessageChannelRendering;
  values: MessageLayoutValues;
}): MessageRenderingResolution {
  const { layout, channelKey, channel } = input;
  if (input.hasLayoutRenderer) return { from: "layout" };

  const fields = fieldsForChannel(layout, channelKey) as MessageLayoutFields;
  const unsupported: MessageFieldType[] = [];
  if (channel.renderGeneric) {
    const used = new Set<MessageFieldType>();
    for (const spec of Object.values(fields)) typesOf(spec, used);
    const allowed = channel.genericFieldTypes;
    unsupported.push(...[...used].filter((type) => allowed && !allowed.includes(type)));
    if (unsupported.length === 0) return { from: "channel", fields };
  }

  if (channel.summaryRenderable && channel.renderFromSummary) {
    try {
      return { from: "summary", summary: layout.summary(input.values) };
    } catch (error) {
      return {
        cannotRender: `ひな形「${layout.label}」の要約を作れません(${error instanceof Error ? error.message : String(error)})`,
      };
    }
  }

  const why = !channel.renderGeneric
    ? "経路に汎用の描き方が無く"
    : `経路の汎用の描き方が欄の型(${unsupported.join("・")})を描けず`;
  return { cannotRender: `経路 ${channelKey} はひな形「${layout.label}」を描けません: ひな形にこの経路の描き方が無く、${why}、要約から描けるとも宣言していません` };
}
