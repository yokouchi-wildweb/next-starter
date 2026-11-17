// src/features/core/messaging/utils/overrideFieldMeta.ts
//
// 文言の編集の欄(ひな形の欄の宣言)→ 今の入力の部品が読む表示の約束(ChannelFieldMeta)。S5 で入力の部品をひな形の欄の型から作り直すまでの最小の合わせ。
// - 1 行の文・日付・数 → line / 段落・長い文 → text / 画像 → image / 選択肢 → select / ボタン・リンク → parts { label, url }
// - 文字の並び(list of line / paragraph / longText)→ list
// - ブロックの並び・組・項目と値・ほかの並びは今の部品で入力できない → null(画面は読むだけ。値の保存は API が受ける)

import type { ChannelFieldMeta, MessageFieldShape } from "@/lib/messaging";

import type { AdminOverrideFieldSpec } from "../services/server/overrides/dto";

function metaOfShape(shape: MessageFieldShape, label: string, placeholder?: string): ChannelFieldMeta | null {
  const help = placeholder ? `例: ${placeholder}` : undefined;
  const base = { label, ...(help ? { help } : {}) };
  switch (shape.type) {
    case "line":
    case "date":
    case "number":
      return { ...base, input: "line" };
    case "paragraph":
    case "longText":
      return { ...base, input: "text" };
    case "image":
      return { ...base, input: "image" };
    case "select":
      return { ...base, input: "select", options: shape.options };
    case "button":
    case "link":
      return {
        ...base,
        input: "line",
        parts: { label: { label: "文言", input: "line" }, url: { label: "行き先(URL)", input: "url" } },
      };
    case "list": {
      const item = metaOfShape(shape.of, label, placeholder);
      return item && !item.parts && !item.list && (item.input === "line" || item.input === "text") ? { ...item, list: true } : null;
    }
    default:
      return null;
  }
}

/** 欄の宣言 → 入力の表示の約束(今の部品で入力できない型は null) */
export function overrideFieldMeta(spec: AdminOverrideFieldSpec | null): ChannelFieldMeta | null {
  return spec ? metaOfShape(spec as MessageFieldShape, spec.label, spec.placeholder) : null;
}
