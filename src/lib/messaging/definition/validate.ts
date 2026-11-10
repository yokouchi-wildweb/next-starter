// src/lib/messaging/definition/validate.ts
//
// 連絡の定義の読み手の検査。定義(と上書きを重ねた結果)の誤りを問題の一覧で返す。
// 送る口が実行時に、registry の生成が生成時に呼ぶ(呼ぶ側は S2 / S6)。

import { listVariables } from "@/lib/structuredDocument/shared";
import type { z } from "zod";

import { UPSTREAM_CHANNEL_FIELDS, type ChannelFieldSchemas } from "./channels";
import type {
  MessageDefinition,
  MessageOverride,
  ResolvedMessageDefinition,
} from "./types";

/**
 * どの連絡でも差し込める共通の文脈の鍵(送る口が埋める)
 * - recipientName / recipientEmail: 受信者
 * - serviceName: サービスの名前(@/business)
 * - appBaseUrl: アプリの起点の URL(getAppBaseUrl)
 */
export const COMMON_CONTEXT_KEYS = [
  "recipientName",
  "recipientEmail",
  "serviceName",
  "appBaseUrl",
] as const;

/** throttle のある連絡だけで差し込める鍵(まとめた回数) */
export const THROTTLE_CONTEXT_KEYS = ["collapsedCount"] as const;

/** 上書きで変えられない項目 */
const OVERRIDE_FORBIDDEN_KEYS = ["key", "kind", "vars", "required"] as const;

export type MessageDefinitionProblemCode =
  | "invalid_key"
  | "required_disabled"
  | "required_without_email"
  | "required_admin_editable"
  | "required_throttle"
  | "unknown_channel"
  | "missing_content"
  | "invalid_content"
  | "unknown_admin_editable"
  | "unknown_variable"
  | "invalid_throttle"
  | "override_forbidden_key";

export type MessageDefinitionProblem = {
  code: MessageDefinitionProblemCode;
  message: string;
};

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/**
 * 定義に上書きを重ねる。content は経路ごとに欄を重ね、throttle: null は外す。
 */
export function applyMessageOverride<Vars extends z.AnyZodObject, C extends ChannelFieldSchemas>(
  definition: MessageDefinition<Vars, C>,
  override?: MessageOverride<C>,
): ResolvedMessageDefinition<Vars, C> {
  const resolved: ResolvedMessageDefinition<Vars, C> = { ...definition, enabled: true };
  if (!override) return resolved;

  if (override.content) {
    const content: Record<string, unknown> = { ...definition.content };
    for (const [channel, fields] of Object.entries(override.content)) {
      if (!fields) continue;
      const base = (content[channel] ?? {}) as Record<string, unknown>;
      content[channel] = { ...base, ...(fields as Record<string, unknown>) };
    }
    resolved.content = content as ResolvedMessageDefinition<Vars, C>["content"];
  }
  if (override.extras) resolved.extras = { ...definition.extras, ...override.extras };
  if (override.defaultChannels) resolved.defaultChannels = override.defaultChannels;
  if (override.enabled !== undefined) resolved.enabled = override.enabled;
  if (override.adminEditable) resolved.adminEditable = override.adminEditable;
  if (override.category !== undefined) resolved.category = override.category;
  if (override.record !== undefined) resolved.record = override.record;
  if (override.throttle === null) {
    delete resolved.throttle;
  } else if (override.throttle !== undefined) {
    resolved.throttle = override.throttle as ResolvedMessageDefinition<Vars, C>["throttle"];
  }
  return resolved;
}

/** 欄の値の中の文字列を全部集める(入れ子の object・配列も) */
function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

function schemaKeys(schema: z.ZodTypeAny): string[] | null {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  return shape && typeof shape === "object" ? Object.keys(shape) : null;
}

/**
 * 定義(と上書き)を検査し、問題の一覧を返す(空 = 通る)。
 * - channels: 経路の欄の zod の束(既定 = 上流の 3 経路。fork の経路は S6 の生成の一覧が渡す)
 * - variableKeys: vars と共通の文脈の他に {{鍵}} で許す鍵(送る口が当たる enrichers の provides の鍵を渡す)
 */
export function validateMessageDefinition<
  Vars extends z.AnyZodObject,
  C extends ChannelFieldSchemas,
>(
  definition: MessageDefinition<Vars, C>,
  options: { override?: MessageOverride<C>; channels?: C; variableKeys?: readonly string[] } = {},
): MessageDefinitionProblem[] {
  const channels = (options.channels ?? UPSTREAM_CHANNEL_FIELDS) as ChannelFieldSchemas;
  const problems: MessageDefinitionProblem[] = [];
  const add = (code: MessageDefinitionProblemCode, message: string) =>
    problems.push({ code, message });
  const label = definition.key;

  if (!KEY_PATTERN.test(definition.key)) {
    add("invalid_key", `${label}: 鍵は <domain>.<name>(英数字の camelCase)で書く`);
  }

  if (options.override) {
    for (const key of OVERRIDE_FORBIDDEN_KEYS) {
      if (key in options.override) {
        add("override_forbidden_key", `${label}: 上書きで ${key} は変えられない`);
      }
    }
    if (definition.required && options.override.enabled === false) {
      add("required_disabled", `${label}: required の連絡は enabled:false にできない`);
    }
  }

  const resolved = applyMessageOverride(definition, options.override);

  if (definition.required) {
    if (!resolved.defaultChannels.includes("email" as never)) {
      add("required_without_email", `${label}: required の連絡から email は外せない`);
    }
    if (resolved.adminEditable && resolved.adminEditable.length > 0) {
      add("required_admin_editable", `${label}: required の連絡に adminEditable は付けられない`);
    }
    if (resolved.throttle) {
      add("required_throttle", `${label}: required の連絡に throttle は付けられない`);
    }
  }

  const content = resolved.content as Record<string, unknown>;
  for (const channel of Object.keys(content)) {
    const schema = channels[channel];
    if (!schema) {
      add("unknown_channel", `${label}: 経路 ${channel} は登録されていない`);
      continue;
    }
    const parsed = schema.safeParse(content[channel]);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`)
        .join(" / ");
      add("invalid_content", `${label}: ${channel} の欄が正しくない(${detail})`);
    }
  }
  for (const channel of resolved.defaultChannels) {
    if (!channels[channel]) {
      add("unknown_channel", `${label}: 経路 ${channel} は登録されていない`);
    } else if (content[channel] === undefined) {
      add("missing_content", `${label}: defaultChannels の ${channel} に欄が無い`);
    }
  }

  for (const path of resolved.adminEditable ?? []) {
    const [channel, field] = String(path).split(".");
    const keys = channels[channel] ? schemaKeys(channels[channel]) : null;
    if (!keys || !field || !keys.includes(field) || content[channel] === undefined) {
      add("unknown_admin_editable", `${label}: adminEditable の ${String(path)} は定義に無い欄`);
    }
  }

  const varKeys = Object.keys(definition.vars.shape);
  if (resolved.throttle) {
    const { by, seconds } = resolved.throttle;
    const unknown = by.filter((key) => !varKeys.includes(key));
    if (unknown.length > 0) {
      add("invalid_throttle", `${label}: throttle.by の ${unknown.join(", ")} は vars に無い`);
    }
    if (!(typeof seconds === "number" && seconds > 0)) {
      add("invalid_throttle", `${label}: throttle.seconds は正の数`);
    }
  }

  const known = new Set<string>([
    ...varKeys,
    ...COMMON_CONTEXT_KEYS,
    ...(resolved.throttle ? THROTTLE_CONTEXT_KEYS : []),
    ...(options.variableKeys ?? []),
  ]);
  const unknownVariables = new Set<string>();
  for (const text of collectStrings(content, [])) {
    for (const key of listVariables(text)) {
      if (!known.has(key)) unknownVariables.add(key);
    }
  }
  for (const key of unknownVariables) {
    add("unknown_variable", `${label}: {{${key}}} は vars にも共通の文脈にも無い`);
  }

  return problems;
}
