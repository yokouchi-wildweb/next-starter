// src/features/core/messaging/components/common/TemplateChannelFields/index.tsx
// 部品(props だけ): テンプレート・送るモーダルの経路 1 つの中身の欄。経路の受け口の欄の表示の約束(fieldMeta、D83)から
// ChannelFields が描く(上流の email・inApp・line も fork の経路も同じ。手で書いた経路ごとの欄・JSON の欄は無い)。
// 画像は用途 notification.image(保存の時にサーバーがテンプレートに結ぶ)

"use client";

import type { ChannelFieldMeta } from "@/lib/messaging";

import { CHANNEL_IMAGE_PURPOSE, ChannelFields } from "../ChannelFields";

/** 画像の用途(storage の purpose。お知らせの画像と同じ) */
export const TEMPLATE_IMAGE_PURPOSE = CHANNEL_IMAGE_PURPOSE;

/** 段落の並び ↔ 空行で区切った文 */
export const paragraphsToText = (value: unknown) => (Array.isArray(value) ? value.map(String).join("\n\n") : "");
export const textToParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

export type TemplateChannelFieldsProps = {
  /** 経路の鍵 */
  channel: string;
  /** 経路の欄の表示の約束(選択肢の channels[].fieldMeta。無ければ値の鍵を 1 行で出す) */
  fieldMeta?: Readonly<Record<string, ChannelFieldMeta>>;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  /** 欄に入った時(プレビューの枠、D80) */
  onFocusField?: (path: string) => void;
  disabled?: boolean;
};

export function TemplateChannelFields({ channel, fieldMeta = {}, value, onChange, onFocusField, disabled }: TemplateChannelFieldsProps) {
  return (
    <ChannelFields
      channel={channel}
      fieldMeta={fieldMeta}
      value={value}
      onChange={onChange}
      onFocusField={onFocusField}
      disabled={disabled}
    />
  );
}
