// src/features/core/messaging/types/channelPreview.ts
//
// 受け口 channelPreviews(D85)の項目の型。経路の受け口の previewComponent の鍵で、管理画面のプレビュー(文言の編集・テンプレート)が
// fork の経路の見た目の部品を引く。項目 = channelPreviews/<名前>.tsx の export const preview。知らない鍵は欄の値を見出し付きで出す

import type { ComponentType } from "react";

import type { ChannelFieldMeta } from "@/lib/messaging";

export type ChannelPreviewComponentProps = {
  /** 経路の欄の値(未保存の値を重ねた物) */
  values: Readonly<Record<string, unknown>>;
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>;
  /** 入力中の欄("<経路>.<欄>[.<部分>]"、無ければ null)。その場所を枠で示す(D80) */
  focusedPath: string | null;
};

export type ChannelPreviewItem = {
  /** 経路の受け口の previewComponent と同じ鍵 */
  key: string;
  Component: ComponentType<ChannelPreviewComponentProps>;
};
