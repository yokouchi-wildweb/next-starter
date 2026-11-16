// src/lib/messaging/layout/vocabulary.ts
//
// ひな形の欄の型の語彙(D123)。lib に 1 か所で固定し、入力・zod・記録・要約・プレビューの 5 か所が読む。
// fork は型を増やさない(入力の部品は src/wiring/formInputs の受け口に登録する)。
// - line 1 行の文 / paragraph 段落 / longText 長い文 / image 画像(storage:// の参照か URL)/ button ボタン {label, url} /
//   link リンク {label?, url} / date 日付 YYYY-MM-DD / number 数 / select 選択肢 / list 並び(1 つの型の並び)/
//   group 組(名前つきの欄)/ keyValue 項目と値 [{key, value}] / blocks ブロックの並び

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
  line: "1 行の文",
  paragraph: "段落",
  longText: "長い文",
  image: "画像",
  button: "ボタン",
  link: "リンク",
  date: "日付",
  number: "数",
  select: "選択肢",
  list: "並び",
  group: "組",
  keyValue: "項目と値",
  blocks: "ブロックの並び",
};

/** 並び・組の中の欄(見出し・経路の印を持たない形) */
export type MessageFieldShape =
  | { type: "line" | "paragraph" | "longText" | "image" | "button" | "link" | "date" | "number" | "keyValue" }
  | { type: "select"; options: readonly { value: string; label: string }[] }
  | { type: "list"; of: MessageFieldShape; min?: number; max?: number }
  | { type: "group"; fields: Readonly<Record<string, MessageFieldShape & { label?: string; required?: boolean }>> }
  | ({ type: "blocks" } & MessageBlocksConstraint);

/** ひな形の欄 1 つの宣言 */
export type MessageFieldSpec = MessageFieldShape & {
  /** 欄の見出し(管理画面) */
  label: string;
  /** 仮の文(入力の欄の例) */
  placeholder?: string;
  /** 必須(空を通さない) */
  required?: boolean;
  /** この欄を使う経路の鍵(無い = 全部の経路)。経路だけの欄の印(ひな形の型は経路を知らず、鍵を値として持つだけ) */
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
      return z.object({ label: z.string().min(1), url: z.string().min(1) }).strict();
    case "link":
      return z.object({ label: z.string().optional(), url: z.string().min(1) }).strict();
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
