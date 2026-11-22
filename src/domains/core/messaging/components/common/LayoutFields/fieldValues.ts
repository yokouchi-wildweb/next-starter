// src/domains/core/messaging/components/common/LayoutFields/fieldValues.ts
// レイアウトの欄の入力の部品が使う純粋な関数(空の値・ブロックの空の形・並びの入れ替え・読むだけの文)。
// 欄の型とブロックの種類は lib(@/lib/messaging のレイアウトの語彙、D123)が決め、ここは入力の初めの形を作るだけ

import {
  MESSAGE_BLOCK_KINDS,
  MESSAGE_BLOCK_KIND_LABELS,
  type MessageBlock,
  type MessageBlockKind,
  type MessageBlocksConstraint,
  type MessageFieldShape,
} from "@/lib/messaging";

/** 欄の型ごとの空の値(新しく足した欄・並びの 1 つ・組の中の欄の初めの値) */
export function emptyValueOf(shape: MessageFieldShape): unknown {
  switch (shape.type) {
    case "line":
    case "paragraph":
    case "longText":
    case "image":
    case "date":
    case "select":
      return "";
    case "number":
      return undefined;
    case "button":
      return { label: "", url: "" };
    case "link":
      return { url: "" };
    case "keyValue":
      return [];
    case "blocks":
      return [];
    case "list":
      return Array.from({ length: shape.min ?? 0 }, () => emptyValueOf(shape.of));
    case "group":
      return Object.fromEntries(Object.entries(shape.fields).map(([key, field]) => [key, emptyValueOf(field)]));
  }
}

/** ブロックの種類ごとの空の形(足した直後の形。保存の前に lib の zod が中身を確かめる) */
export function emptyBlockOf(kind: MessageBlockKind): MessageBlock {
  switch (kind) {
    case "heading":
      return { type: "heading", text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "button":
      return { type: "button", label: "", url: "" };
    case "image":
      return { type: "image", src: "" };
    case "divider":
      return { type: "divider" };
    case "keyValueTable":
      return { type: "keyValueTable", rows: [{ key: "", value: "" }] };
    case "bulletList":
      return { type: "bulletList", items: [""] };
  }
}

/** その欄で足せるブロックの種類(allow が無ければ全部。並びは lib の選択肢の順) */
export function allowedBlockKinds(constraint: MessageBlocksConstraint): { value: MessageBlockKind; label: string }[] {
  return MESSAGE_BLOCK_KINDS.filter((kind) => !constraint.allow || constraint.allow.includes(kind)).map((kind) => ({
    value: kind,
    label: MESSAGE_BLOCK_KIND_LABELS[kind],
  }));
}

/** 並びの index の物を 1 つ上(-1)か下(+1)へ。端を越える時はそのまま */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 並びの index の物を消す */
export function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** 並びの index の物を差し替える */
export function replaceItem<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

/** 値を並びとして読む(並びでなければ空) */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 値を object として読む(object でなければ空) */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** 値を文字として読む(無い = 空文字) */
export function asText(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

/** 1 行の欄の値(改行を空白に、D78) */
export function oneLine(value: string): string {
  return value.replace(/\r?\n/g, " ");
}
