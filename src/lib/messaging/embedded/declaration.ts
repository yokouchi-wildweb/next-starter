// src/lib/messaging/embedded/declaration.ts
//
// 専用の埋め込み情報の宣言(テンプレートが持つ、D111・D126)と値の検査。
// - 型: line 1 行の文 / number 数 / date 日付 YYYY-MM-DD / datetime 日時(ISO 8601、時差つき)/ url / select 選択肢(options の value)
// - 値は送る人がテンプレートを送る時に入れる。差し込む時は文字にする(数は数字の字、日付・日時は入れた字のまま)
// - required: 空は既定値(default)、既定値も無ければ誤り。任意で空なら空の字

import { z } from "zod";

import { EMBEDDED_ALIAS_PATTERN, EMBEDDED_KEY_PATTERN } from "./names";

export const MESSAGE_EMBEDDED_TYPES = ["line", "number", "date", "datetime", "url", "select"] as const;
export type MessageEmbeddedType = (typeof MESSAGE_EMBEDDED_TYPES)[number];

/** 型の表示名(管理画面) */
export const MESSAGE_EMBEDDED_TYPE_LABELS: Readonly<Record<MessageEmbeddedType, string>> = {
  line: "1 行の文",
  number: "数",
  date: "日付",
  datetime: "日時",
  url: "URL",
  select: "選択肢",
};

/** 専用の埋め込み情報の宣言 1 つ */
export type MessageEmbeddedDeclaration = {
  /** 鍵(英数字の camelCase。{{鍵}} で書ける) */
  key: string;
  /** 日本語の別名({{別名}} で書ける。専用どうし・共通・enrichers の名前と重ならない) */
  alias: string;
  type: MessageEmbeddedType;
  /** select の選択肢 */
  options?: readonly { value: string; label: string }[];
  required: boolean;
  /** 既定値(型の値の形) */
  default?: string | number;
};

const optionSchema = z.object({ value: z.string().min(1).max(200), label: z.string().min(1).max(200) }).strict();

/** 宣言 1 つの zod(保存の時に通す。select は options が要る、ほかの型は持たない) */
export const messageEmbeddedDeclarationSchema = z
  .object({
    key: z.string().regex(EMBEDDED_KEY_PATTERN, "鍵は英字で始まる英数字(camelCase)で書きます").max(64),
    alias: z.string().regex(EMBEDDED_ALIAS_PATTERN, "別名は空白・記号を含まない文字で書きます").max(64),
    type: z.enum(MESSAGE_EMBEDDED_TYPES),
    options: z.array(optionSchema).min(1).max(100).optional(),
    required: z.boolean(),
    default: z.union([z.string().max(2000), z.number()]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "select" && !value.options) ctx.addIssue({ code: "custom", path: ["options"], message: "選択肢の型は options が要ります" });
    if (value.type !== "select" && value.options) ctx.addIssue({ code: "custom", path: ["options"], message: "options は選択肢の型だけが持ちます" });
    if (value.default !== undefined && value.default !== "") {
      const parsed = embeddedTextOf(value as MessageEmbeddedDeclaration, value.default);
      if (parsed === null) ctx.addIssue({ code: "custom", path: ["default"], message: `既定値が型 ${value.type} の形ではありません` });
    }
  });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;

function validDate(text: string): boolean {
  if (!DATE.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/** 値を差し込む字にする(型の形でなければ null) */
export function embeddedTextOf(declaration: Pick<MessageEmbeddedDeclaration, "type" | "options">, value: unknown): string | null {
  switch (declaration.type) {
    case "number":
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return typeof value === "string" && NUMBER_TEXT.test(value.trim()) ? value.trim() : null;
    case "date":
      return typeof value === "string" && validDate(value.trim()) ? value.trim() : null;
    case "datetime":
      return typeof value === "string" && z.string().datetime({ offset: true }).safeParse(value.trim()).success ? value.trim() : null;
    case "url":
      return typeof value === "string" && z.string().url().safeParse(value.trim()).success ? value.trim() : null;
    case "select":
      return typeof value === "string" && (declaration.options ?? []).some((option) => option.value === value) ? value : null;
    default:
      return typeof value === "string" && !/[\r\n]/.test(value) ? value : null;
  }
}

/**
 * 値 1 つの zod(送る人が入れた値 → 差し込む字)。空は既定値、必須で既定値も無ければ誤り、任意なら空の字
 */
export function embeddedValueSchema(declaration: MessageEmbeddedDeclaration): z.ZodType<string, z.ZodTypeDef, unknown> {
  return z.unknown().transform((value, ctx) => {
    const empty = value === undefined || value === null || value === "";
    const source = empty ? declaration.default : value;
    if (source === undefined || source === "") {
      if (!declaration.required) return "";
      ctx.addIssue({ code: "custom", message: `${declaration.alias}(${declaration.key})は必須です` });
      return z.NEVER;
    }
    const text = embeddedTextOf(declaration, source);
    if (text === null) {
      ctx.addIssue({ code: "custom", message: `${declaration.alias}(${declaration.key})が型 ${MESSAGE_EMBEDDED_TYPE_LABELS[declaration.type]} の形ではありません` });
      return z.NEVER;
    }
    return text;
  });
}

/** 宣言の並びの値の zod(鍵 → 差し込む字。知らない鍵は通らない) */
export function embeddedValuesSchema(declarations: readonly MessageEmbeddedDeclaration[]) {
  return z.object(Object.fromEntries(declarations.map((declaration) => [declaration.key, embeddedValueSchema(declaration)]))).strict();
}
