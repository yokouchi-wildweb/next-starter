// src/lib/messaging/layout/vocabulary.ts
//
// レイアウトの欄の型の語彙(D123)。lib に 1 か所で固定し、入力・zod・記録・要約・プレビューの 5 か所が読む。
// fork は型を増やさない(入力の部品は src/wiring/formInputs の受け口に登録する)。
// - line 1行テキスト / paragraph 段落 / longText 複数行テキスト / image 画像(storage:// の参照か URL)/ button ボタン {label, url} /
//   link リンク {label?, url} / date 日付 YYYY-MM-DD / number 数 / select 選択肢 / list 並び(1 つの型の並び)/
//   group 組(名前つきの欄)/ keyValue ラベルと値 [{key, value}] / blocks ブロックの並び
// - 空の値(D128): 任意の欄の空は「無い」。画像の空文字・ボタン / リンクの全部が空・空の並びは検査の前に外す(normalizeFieldValue、
//   layoutValuesSchema とサーバーの送る口・フォームが通る)。ボタンの片方だけ空・ラベルだけのリンクは空の側の誤り

import { z } from "zod";

import { messageBlocksSchema, type MessageBlock, type MessageBlocksConstraint } from "./blocks";

/** 欄の型(lib で固定) */
export const MESSAGE_FIELD_TYPES = [
  "line",
  "paragraph",
  "longText",
  "image",
  "button",
  "link",
  "date",
  "number",
  "select",
  "list",
  "group",
  "keyValue",
  "blocks",
] as const;

export type MessageFieldType = (typeof MESSAGE_FIELD_TYPES)[number];

/** 欄の型の表示名(管理画面) */
export const MESSAGE_FIELD_TYPE_LABELS: Readonly<Record<MessageFieldType, string>> = {
  line: "1行テキスト",
  paragraph: "段落",
  longText: "複数行テキスト",
  image: "画像",
  button: "ボタン",
  link: "リンク",
  date: "日付",
  number: "数",
  select: "選択肢",
  list: "並び",
  group: "組",
  keyValue: "ラベルと値",
  blocks: "ブロックの並び",
};

/** 並び・組の中の欄(見出し・送信チャンネルの印を持たない形) */
export type MessageFieldShape =
  | { type: "line" | "paragraph" | "longText" | "image" | "button" | "link" | "date" | "number" | "keyValue" }
  | { type: "select"; options: readonly { value: string; label: string }[] }
  | { type: "list"; of: MessageFieldShape; min?: number; max?: number }
  | { type: "group"; fields: Readonly<Record<string, MessageFieldShape & { label?: string; required?: boolean }>> }
  | ({ type: "blocks" } & MessageBlocksConstraint);

/** レイアウトの欄 1 つの宣言 */
export type MessageFieldSpec = MessageFieldShape & {
  /** 欄の見出し(管理画面) */
  label: string;
  /** 仮の文(入力の欄の例) */
  placeholder?: string;
  /** 必須(空を通さない) */
  required?: boolean;
  /**
   * この送信チャンネルのどれかを送る時だけ必須(例 件名 = ["email"]、D211)。欄はどの送信チャンネルにも渡る(channels と違い、他の送信チャンネルから隠さない)。
   * 送る送信チャンネルが分からない検査(layoutValuesSchema に channels を渡さない)では任意
   */
  requiredFor?: readonly string[];
  /** この欄を使う送信チャンネルの鍵(無い = 全部の送信チャンネル)。送信チャンネルだけの欄の印(レイアウトの型は送信チャンネルを知らず、鍵を値として持つだけ) */
  channels?: readonly string[];
};

/** 欄の型ごとの値の形 */
export type MessageFieldValue<S extends MessageFieldShape> = S extends { type: "line" | "paragraph" | "longText" | "image" | "date" }
  ? string
  : S extends { type: "select" }
    ? string
    : S extends { type: "number" }
      ? number
      : S extends { type: "button" }
        ? { label: string; url: string }
        : S extends { type: "link" }
          ? { label?: string; url: string }
          : S extends { type: "keyValue" }
            ? { key: string; value: string }[]
            : S extends { type: "blocks" }
              ? MessageBlock[]
              : S extends { type: "list"; of: infer O extends MessageFieldShape }
                ? MessageFieldValue<O>[]
                : S extends { type: "group"; fields: infer F extends Record<string, MessageFieldShape> }
                  ? { [K in keyof F]?: MessageFieldValue<F[K]> }
                  : unknown;

const text = z.string();

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * 欄の値の空を「無い」(undefined)にする(D128)。検査の前に通す(layoutValuesSchema・送る口・フォーム)。
 * - 画像の空文字 / ボタン・リンクの全部の部分が空 / 空の並び(list・keyValue・blocks)→ undefined
 * - 並びは中の空を外す、組は中の欄ごとに整えて無い欄の鍵を外す。ほかの型・形の違う値はそのまま(検査が言う)
 */
export function normalizeFieldValue(shape: MessageFieldShape, value: unknown): unknown {
  switch (shape.type) {
    case "image":
      return isBlank(value) ? undefined : value;
    case "button":
    case "link": {
      if (isBlank(value)) return undefined;
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const parts = value as Record<string, unknown>;
      return isBlank(parts.label) && isBlank(parts.url) ? undefined : value;
    }
    case "keyValue":
    case "blocks":
      return Array.isArray(value) && value.length === 0 ? undefined : value;
    case "list": {
      if (!Array.isArray(value)) return value;
      const items = value.map((item) => normalizeFieldValue(shape.of, item)).filter((item) => item !== undefined);
      return items.length === 0 ? undefined : items;
    }
    case "group": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        const field = shape.fields[key];
        const next = field ? normalizeFieldValue(field, inner) : inner;
        if (next !== undefined) out[key] = next;
      }
      return out;
    }
    default:
      return value;
  }
}

/**
 * 欄の値の zod(必須かは呼び手が決める: ここは「値があるならこの形」)。
 * 文字の型は空文字も通す(必須の空の確かめは layoutValuesSchema)
 */
export function fieldValueSchema(shape: MessageFieldShape): z.ZodTypeAny {
  switch (shape.type) {
    case "line":
      return text.max(500);
    case "paragraph":
    case "longText":
      return text;
    case "image":
      return text.min(1);
    case "button":
      // 片方だけ入っている時は空の側の誤り(全部が空は normalizeFieldValue が「無い」にする)
      return z
        .object({ label: z.string(), url: z.string() })
        .strict()
        .superRefine((button, ctx) => {
          if (button.label.trim() === "") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["label"], message: "ボタンの文言を入れてください" });
          if (button.url.trim() === "") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "ボタンの URL を入れてください" });
        });
    case "link":
      return z
        .object({ label: z.string().optional(), url: z.string().trim().min(1, "リンクの URL を入れてください") })
        .strict();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD で入力してください");
    case "number":
      return z.number().finite();
    case "select": {
      const values = shape.options.map((option) => option.value);
      return z.string().refine((value) => values.includes(value), { message: "選択肢にない値です" });
    }
    case "keyValue":
      return z.array(z.object({ key: z.string().min(1), value: z.string() }).strict());
    case "blocks":
      return messageBlocksSchema(shape);
    case "list": {
      let schema = z.array(fieldValueSchema(shape.of));
      if (shape.min !== undefined) schema = schema.min(shape.min);
      if (shape.max !== undefined) schema = schema.max(shape.max);
      return schema;
    }
    case "group":
      return z
        .object(
          Object.fromEntries(
            Object.entries(shape.fields).map(([key, field]) => {
              const schema = fieldValueSchema(field);
              return [key, field.required ? requiredValue(schema) : schema.optional()];
            }),
          ),
        )
        .strict();
  }
}

/** 必須の値: 無い・空文字・空の並びは通さない */
export function requiredValue(schema: z.ZodTypeAny): z.ZodTypeAny {
  return schema.refine(
    (value) => !(value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)),
    { message: "入力してください" },
  );
}
