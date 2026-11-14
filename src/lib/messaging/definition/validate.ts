// src/lib/messaging/definition/validate.ts
//
// 連絡の定義の読み手の検査。定義(と上書きを重ねた結果)の誤りを問題の一覧で返す。
// 送る口が実行時に、registry の生成が生成時に呼ぶ(呼ぶ側は S2 / S6)。
// 種別と経路は定義に無く、属する種類(category)から引く(D81・D86): 文面は種類の経路の分だけ必須、種別の性質(MESSAGE_KIND_TRAITS)で
// 管理画面の文言の上書き・間引きを止める。

import { listVariables } from "@/lib/structuredDocument/shared";
import type { z } from "zod";

import type { MessageCategory, MessageCategoryGroup } from "../receptacles/types";
import { UPSTREAM_CHANNEL_FIELDS, type ChannelFieldSchemas } from "./channels";
import { MESSAGE_KIND_TRAITS, isMessageKind } from "./kinds";
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

/** 上書きで変えられない項目(category は付け替えない D74、kind・defaultChannels は定義に無い) */
const OVERRIDE_FORBIDDEN_KEYS = ["key", "kind", "vars", "required", "category", "defaultChannels"] as const;

export type MessageDefinitionProblemCode =
  | "invalid_key"
  | "missing_label"
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
  | "override_forbidden_key"
  | "unknown_category"
  | "kind_admin_editable"
  | "kind_throttle"
  | "authored_content"
  | "authored_field"
  | "authored_override";

export type MessageDefinitionProblem = {
  code: MessageDefinitionProblemCode;
  message: string;
};

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/** 上書きを重ねた定義(種類から引く種別・経路はまだ付けない) */
export type OverriddenMessageDefinition<Vars extends z.AnyZodObject, C extends ChannelFieldSchemas> = MessageDefinition<Vars, C> & {
  enabled: boolean;
};

/**
 * 定義に上書きを重ねる。content は経路ごとに欄を重ね、throttle: null は外す。種別と経路は resolveMessageDefinition が種類から付ける
 */
export function applyMessageOverride<Vars extends z.AnyZodObject, C extends ChannelFieldSchemas>(
  definition: MessageDefinition<Vars, C>,
  override?: MessageOverride<C>,
): OverriddenMessageDefinition<Vars, C> {
  const resolved: OverriddenMessageDefinition<Vars, C> = { ...definition, enabled: true };
  if (!override) return resolved;

  if (override.content) {
    const content: Record<string, unknown> = { ...definition.content };
    for (const [channel, fields] of Object.entries(override.content)) {
      if (!fields) continue;
      const base = (content[channel] ?? {}) as Record<string, unknown>;
      content[channel] = { ...base, ...(fields as Record<string, unknown>) };
    }
    resolved.content = content as MessageDefinition<Vars, C>["content"];
  }
  if (override.label !== undefined) resolved.label = override.label;
  if (override.extras) resolved.extras = { ...definition.extras, ...override.extras };
  if (override.enabled !== undefined) resolved.enabled = override.enabled;
  if (override.adminEditable) resolved.adminEditable = override.adminEditable;
  if (override.record !== undefined) resolved.record = override.record;
  if (override.throttle === null) {
    delete resolved.throttle;
  } else if (override.throttle !== undefined) {
    resolved.throttle = override.throttle as MessageDefinition<Vars, C>["throttle"];
  }
  return resolved;
}

/** 上書きを重ね、属する種類(category)から種別と経路を付ける(D81・D86) */
export function resolveMessageDefinition<Vars extends z.AnyZodObject, C extends ChannelFieldSchemas>(
  definition: MessageDefinition<Vars, C>,
  override: MessageOverride<C> | undefined,
  category: Pick<MessageCategory, "kind" | "channels">,
): ResolvedMessageDefinition<Vars, C> {
  return {
    ...applyMessageOverride(definition, override),
    kind: category.kind,
    channels: [...category.channels] as ResolvedMessageDefinition<Vars, C>["channels"],
  };
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
 * - categories: categories の受け口(鍵 → 項目、fork の種類の override を重ねた後)。定義の category を照らし、種別と経路を引く
 * - channels: 経路の欄の zod の束(既定 = 上流の 3 経路。fork の経路は経路の受け口の項目の欄)
 * - variableKeys: vars と共通の文脈の他に {{鍵}} で許す鍵(送る口が当たる enrichers の provides の鍵を渡す)
 */
export function validateMessageDefinition<
  Vars extends z.AnyZodObject,
  C extends ChannelFieldSchemas,
>(
  definition: MessageDefinition<Vars, C>,
  options: {
    categories: Readonly<Record<string, Pick<MessageCategory, "kind" | "channels">>>;
    override?: MessageOverride<C>;
    channels?: C;
    variableKeys?: readonly string[];
  },
): MessageDefinitionProblem[] {
  const channels = (options.channels ?? UPSTREAM_CHANNEL_FIELDS) as ChannelFieldSchemas;
  const problems: MessageDefinitionProblem[] = [];
  const add = (code: MessageDefinitionProblemCode, message: string) =>
    problems.push({ code, message });
  const label = definition.key;

  if (!KEY_PATTERN.test(definition.key)) {
    add("invalid_key", `${label}: 鍵は <domain>.<name>(英数字の camelCase)で書く`);
  }
  // 名前(管理画面の表示名、必須。運営する人は鍵を読まない D46)。上書きでも空にできない
  const named = options.override?.label ?? definition.label;
  if (typeof named !== "string" || named.trim() === "") {
    add("missing_label", `${label}: label(管理画面に出す連絡の名前。例 "パスワードの再設定")を書く`);
  }

  if (definition.authored) {
    // 文面を送るたびに受け取る定義: 文面・管理画面の欄・間引きを持たず、上書きも当たらない(送った文面に重ねる物が無い)
    if (Object.keys(definition.content ?? {}).length > 0) {
      add("authored_content", `${label}: authored の連絡は content を空 {} にする(文面は送る時に受け取る)`);
    }
    if ((definition.adminEditable?.length ?? 0) > 0 || definition.throttle) {
      add("authored_field", `${label}: authored の連絡に adminEditable・throttle は付けられない`);
    }
    if (options.override) add("authored_override", `${label}: authored の連絡は上書きできない`);
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

  // 種類(全部の連絡に必須、D81): 受け口に無い鍵は誤り。種別と経路は種類から引く
  const category = typeof definition.category === "string" ? options.categories[definition.category] : undefined;
  if (!category) {
    const keys = Object.keys(options.categories);
    add(
      "unknown_category",
      `${label}: category ${String(definition.category)} は categories の受け口に無い(${keys.join(" / ") || "項目なし"})。先に categories/<名前>.ts を足す`,
    );
    return problems;
  }

  const resolved = resolveMessageDefinition(definition, options.override, category);
  const traits = MESSAGE_KIND_TRAITS[resolved.kind];

  if (definition.required) {
    if (!resolved.channels.includes("email" as never)) {
      add("required_without_email", `${label}: required の連絡の種類の経路に email が要る`);
    }
    if (resolved.adminEditable && resolved.adminEditable.length > 0) {
      add("required_admin_editable", `${label}: required の連絡に adminEditable は付けられない`);
    }
    if (resolved.throttle) {
      add("required_throttle", `${label}: required の連絡に throttle は付けられない`);
    }
  }
  if (!traits.adminTextOverride && resolved.adminEditable && resolved.adminEditable.length > 0) {
    add("kind_admin_editable", `${label}: 種別 ${resolved.kind} の連絡は管理画面で文言を直せない(adminEditable を付けない)`);
  }
  if (!traits.throttle && resolved.throttle) {
    add("kind_throttle", `${label}: 種別 ${resolved.kind} の連絡は間引けない(throttle を付けない)`);
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
  // 文面は種類の経路の分だけ必須(D86)。authored の定義は送る口が受けた文面で埋めてから検査する
  for (const channel of resolved.channels) {
    if (!channels[channel]) {
      add("unknown_channel", `${label}: 種類 ${definition.category} の経路 ${channel} は登録されていない`);
    } else if (!definition.authored && content[channel] === undefined) {
      add("missing_content", `${label}: 種類 ${definition.category} の経路 ${channel} に欄が無い`);
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

export type MessageCategoryProblem = { code: "unknown_kind" | "empty_channels" | "unknown_group" | "group_kind_mismatch"; message: string };

/**
 * 種類の受け口の検査(種類の override を重ねた後): 種別は 7 つのどれか・経路が 1 つ以上・group はグループの受け口の鍵で、
 * 1 つのグループの種類は同じ種別(D82)
 */
export function validateMessageCategories(
  categories: Readonly<Record<string, MessageCategory>>,
  groups: Readonly<Record<string, MessageCategoryGroup>> = {},
): MessageCategoryProblem[] {
  const problems: MessageCategoryProblem[] = [];
  const kindOfGroup = new Map<string, { kind: string; category: string }>();
  for (const [key, category] of Object.entries(categories)) {
    if (!isMessageKind(category.kind)) problems.push({ code: "unknown_kind", message: `種類 ${key}: 種別 ${String(category.kind)} は無い` });
    if (!Array.isArray(category.channels) || category.channels.length === 0) {
      problems.push({ code: "empty_channels", message: `種類 ${key}: 経路が無い(channels に 1 つ以上)` });
    }
    if (category.group === undefined) continue;
    if (!groups[category.group]) {
      problems.push({ code: "unknown_group", message: `種類 ${key}: group ${category.group} は categoryGroups の受け口に無い` });
      continue;
    }
    const seen = kindOfGroup.get(category.group);
    if (!seen) kindOfGroup.set(category.group, { kind: category.kind, category: key });
    else if (seen.kind !== category.kind) {
      problems.push({
        code: "group_kind_mismatch",
        message: `種類 ${key}: グループ ${category.group} には種別 ${seen.kind} の種類(${seen.category})があり、種別 ${category.kind} は入れられない`,
      });
    }
  }
  return problems;
}
