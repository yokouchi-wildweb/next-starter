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
  line: "1行テキスト",
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
  return z
    .object({
      ...Object.fromEntries(declarations.map((declaration) => [declaration.key, embeddedValueSchema(declaration)])),
      // 日付・日時は型の印も出す(回に値と一緒に残り、差し込む時に人が読む字にする: displayEmbeddedValues)
      ...embeddedTypeShape(declarations),
    })
    .strict();
}

/**
 * 型の印の鍵の後ろ(回に残す専用の値の隣に `<鍵>@type` = 型 を置く、D128: 組み直しは回だけから描く)。
 * `@` は差し込みの書式 {{名前}} に拾われないので、印が文面に出ることは無い
 */
export const EMBEDDED_TYPE_SUFFIX = "@type";

/** 人が読む字にする型(日付・日時)。ほかの型は値の字のまま */
const DISPLAY_TIME_ZONE = "Asia/Tokyo";

/**
 * 値の字(ISO)→ 人が読む字。date = 2026年12月1日 / datetime = 2026年12月1日 11:00(日本時間)。読めない字・ほかの型はそのまま
 */
export function embeddedDisplayText(type: string, text: string): string {
  if (type === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return match ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日` : text;
  }
  if (type === "datetime") {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("ja-JP", {
        timeZone: DISPLAY_TIME_ZONE,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
  }
  return text;
}

/**
 * 差し込みの表の専用の値を人が読む字にする(隣の `<鍵>@type` の型で。印の行は表から外す)。
 * 送る時(版の宣言の vars が印を足す)も組み直し(回の embedded_values が印を持つ)も同じこの 1 か所
 */
export function displayEmbeddedValues(map: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (key.endsWith(EMBEDDED_TYPE_SUFFIX)) continue;
    const type = map[`${key}${EMBEDDED_TYPE_SUFFIX}`];
    out[key] = type ? embeddedDisplayText(type, value) : value;
  }
  return out;
}

/** 宣言の型の印の zod の形(日付・日時の宣言だけ。値に関わらず `<鍵>@type` = 型 を出す) */
export function embeddedTypeShape(declarations: readonly MessageEmbeddedDeclaration[]): Record<string, z.ZodType<string, z.ZodTypeDef, unknown>> {
  return Object.fromEntries(
    declarations
      .filter((declaration) => declaration.type === "date" || declaration.type === "datetime")
      .map((declaration) => [`${declaration.key}${EMBEDDED_TYPE_SUFFIX}`, z.unknown().transform(() => declaration.type)]),
  );
}
