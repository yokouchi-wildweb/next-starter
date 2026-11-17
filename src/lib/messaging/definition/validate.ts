// src/lib/messaging/definition/validate.ts
//
// 連絡の定義の読み手の検査。定義(と上書きを重ねた結果)の誤りを問題の一覧で返す。
// 送る口が実行時に、registry の生成が生成時に呼ぶ(呼ぶ側は S2 / S6)。
// 種別と経路は定義に無く、属する種類(category)から引く(D81・D86)。種別の性質(MESSAGE_KIND_TRAITS)で管理画面の文言の上書き・間引きを止める。
// 中身はひな形 + 欄の中身(D122): ひな形が受け口にあり、欄の中身が種類の経路で使う欄の zod(layoutValuesSchema)を通り、{{鍵}} が宣言済み。

import { listVariables } from "@/lib/structuredDocument/shared";
import type { z } from "zod";

import type { MessageLayout } from "../layout/types";
import { layoutValuesSchema } from "../layout/values";
import type { MessageCategory, MessageCategoryGroup } from "../receptacles/types";
import { MESSAGE_COMMON_EMBEDDED } from "../embedded/common";
import { EMBEDDED_ALIAS_PATTERN } from "../embedded/names";
import { MESSAGE_KIND_TRAITS, isMessageKind } from "./kinds";
import type {
  MessageDefinition,
  MessageOverride,
  ResolvedMessageDefinition,
} from "./types";

/**
 * どの連絡でも差し込める共通の文脈の鍵(送る口が埋める)。一覧(鍵・日本語の別名・説明)は embedded/common.ts の 1 か所
 * - recipientName / recipientEmail: 受信者
 * - serviceName: サービスの名前(@/business)
 * - appBaseUrl: アプリの起点の URL(getAppBaseUrl)
 */
export const COMMON_CONTEXT_KEYS: readonly string[] = MESSAGE_COMMON_EMBEDDED.filter((item) => !item.throttleOnly).map((item) => item.key);

/** throttle のある連絡だけで差し込める鍵(まとめた回数) */
export const THROTTLE_CONTEXT_KEYS: readonly string[] = MESSAGE_COMMON_EMBEDDED.filter((item) => item.throttleOnly).map((item) => item.key);

/** 上書きで変えられない項目(category は付け替えない D74、kind・defaultChannels は定義に無い、varNames は vars と対 D133) */
const OVERRIDE_FORBIDDEN_KEYS = ["key", "kind", "vars", "varNames", "required", "category", "defaultChannels"] as const;

export type MessageDefinitionProblemCode =
  | "invalid_key"
  | "missing_label"
  | "required_disabled"
  | "required_without_email"
  | "required_admin_editable"
  | "required_throttle"
  | "unknown_channel"
  | "unknown_layout"
  | "invalid_values"
  | "unknown_admin_editable"
  | "unknown_variable"
  | "invalid_throttle"
  | "override_forbidden_key"
  | "unknown_category"
  | "kind_admin_editable"
  | "kind_throttle"
  | "missing_var_name"
  | "invalid_var_name"
  | "var_name_clash";

export type MessageDefinitionProblem = {
  code: MessageDefinitionProblemCode;
  message: string;
};

/** 経路の受け口を渡さない時の既定(上流の 3 経路) */
const UPSTREAM_CHANNEL_KEYS: readonly string[] = ["email", "inApp", "line"];

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/** 上書きを重ねた定義(種類から引く種別・経路はまだ付けない) */
export type OverriddenMessageDefinition<Vars extends z.AnyZodObject> = MessageDefinition<Vars> & {
  enabled: boolean;
};

/**
 * 定義に上書きを重ねる。values はひな形の欄ごとに差し替え、throttle: null は外す。種別と経路は resolveMessageDefinition が種類から付ける
 */
export function applyMessageOverride<Vars extends z.AnyZodObject>(
  definition: MessageDefinition<Vars>,
  override?: MessageOverride,
): OverriddenMessageDefinition<Vars> {
  const resolved: OverriddenMessageDefinition<Vars> = { ...definition, enabled: true };
  if (!override) return resolved;

  if (override.values) resolved.values = { ...definition.values, ...override.values };
  if (override.label !== undefined) resolved.label = override.label;
  if (override.extras) resolved.extras = { ...definition.extras, ...override.extras };
  if (override.enabled !== undefined) resolved.enabled = override.enabled;
  if (override.adminEditableOnly) resolved.adminEditableOnly = override.adminEditableOnly;
  if (override.record !== undefined) resolved.record = override.record;
  if (override.throttle === null) {
    delete resolved.throttle;
  } else if (override.throttle !== undefined) {
    resolved.throttle = override.throttle as MessageDefinition<Vars>["throttle"];
  }
  return resolved;
}

/** 上書きを重ね、属する種類(category)から種別と経路を付ける(D81・D86) */
export function resolveMessageDefinition<Vars extends z.AnyZodObject>(
  definition: MessageDefinition<Vars>,
  override: MessageOverride | undefined,
  category: Pick<MessageCategory, "kind" | "channels">,
): ResolvedMessageDefinition<Vars> {
  return {
    ...applyMessageOverride(definition, override),
    kind: category.kind,
    channels: [...category.channels],
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

/**
 * 定義(と上書き)を検査し、問題の一覧を返す(空 = 通る)。
 * - categories: categories の受け口(鍵 → 項目、fork の種類の override を重ねた後)。定義の category を照らし、種別と経路を引く
 * - layouts: ひな形の受け口(鍵 → ひな形)。定義の layout を照らし、欄の中身を検査する
 * - channels: 登録された経路の鍵(既定 = 上流の 3 経路 email・inApp・line。送る口は経路の受け口の鍵を渡す)。経路の有無だけに使う
 * - variableKeys: vars と共通の文脈(鍵・別名)の他に {{名前}} で許す名前(送る口が当たる enrichers の provides の鍵と別名を渡す)
 * - embeddedNames: 共通の他にこの連絡で見える埋め込み情報の鍵と別名の組(当たる enrichers と、enricher と同じ鍵の vars)。vars の別名の重なりを照らす
 */
export function validateMessageDefinition<
  Vars extends z.AnyZodObject,
>(
  definition: MessageDefinition<Vars>,
  options: {
    categories: Readonly<Record<string, Pick<MessageCategory, "kind" | "channels">>>;
    layouts: Readonly<Record<string, MessageLayout>>;
    override?: MessageOverride;
    channels?: readonly string[];
    variableKeys?: readonly string[];
    embeddedNames?: readonly { key: string; alias: string }[];
  },
): MessageDefinitionProblem[] {
  const channels = new Set(options.channels ?? UPSTREAM_CHANNEL_KEYS);
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
    if (!resolved.channels.includes("email")) {
      add("required_without_email", `${label}: required の連絡の種類の経路に email が要る`);
    }
    if (resolved.adminEditableOnly && resolved.adminEditableOnly.length > 0) {
      add("required_admin_editable", `${label}: required の連絡に adminEditableOnly は付けられない`);
    }
    if (resolved.throttle) {
      add("required_throttle", `${label}: required の連絡に throttle は付けられない`);
    }
  }
  if (!traits.adminTextOverride && resolved.adminEditableOnly && resolved.adminEditableOnly.length > 0) {
    add("kind_admin_editable", `${label}: 種別 ${resolved.kind} の連絡は管理画面で文言を直せない(adminEditableOnly を付けない)`);
  }
  if (!traits.throttle && resolved.throttle) {
    add("kind_throttle", `${label}: 種別 ${resolved.kind} の連絡は間引けない(throttle を付けない)`);
  }

  for (const channel of resolved.channels) {
    if (!channels.has(channel)) {
      add("unknown_channel", `${label}: 種類 ${definition.category} の経路 ${channel} は登録されていない`);
    }
  }
  // ひな形と欄の中身(D122・D125): 種類の経路で使う欄だけを検査する
  const values = (resolved.values ?? {}) as Record<string, unknown>;
  const layout = typeof definition.layout === "string" ? options.layouts[definition.layout] : undefined;
  if (!layout) {
    const keys = Object.keys(options.layouts);
    add("unknown_layout", `${label}: layout ${String(definition.layout)} は layouts の受け口に無い(${keys.join(" / ") || "項目なし"})`);
  } else {
    const parsed = layoutValuesSchema(layout, { channels: resolved.channels }).safeParse(values);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`)
        .join(" / ");
      add("invalid_values", `${label}: ひな形「${layout.label}」の欄の中身が正しくない(${detail})`);
    }
  }

  // adminEditableOnly = ひな形の欄の鍵(D132)。ひな形に無い欄は誤り(ひな形が無い時は上の unknown_layout が言う)
  if (layout) {
    for (const key of resolved.adminEditableOnly ?? []) {
      if (!(String(key) in layout.fields)) {
        add("unknown_admin_editable", `${label}: adminEditableOnly の ${String(key)} はひな形「${layout.label}」の欄に無い`);
      }
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

  problems.push(...varNameProblems(definition, label, resolved.throttle ? true : false, options.embeddedNames ?? []));
  const varAliases = varKeys.flatMap((key) => {
    const alias = (definition.varNames as Readonly<Record<string, { alias?: unknown }>> | undefined)?.[key]?.alias;
    return typeof alias === "string" && alias !== "" ? [alias] : [];
  });

  const known = new Set<string>([
    ...varKeys,
    // vars の日本語の別名(D133。送る口が鍵と同じ値で埋める)
    ...varAliases,
    ...COMMON_CONTEXT_KEYS,
    ...(resolved.throttle ? THROTTLE_CONTEXT_KEYS : []),
    // 共通の埋め込み情報の日本語の別名({{受信者名}} など、D126。送る口が同じ値で埋める)
    ...MESSAGE_COMMON_EMBEDDED.filter((item) => !item.throttleOnly || resolved.throttle).map((item) => item.alias),
    ...(options.variableKeys ?? []),
  ]);
  const unknownVariables = new Set<string>();
  for (const text of collectStrings(values, [])) {
    for (const key of listVariables(text)) {
      if (!known.has(key)) unknownVariables.add(key);
    }
  }
  for (const key of unknownVariables) {
    add("unknown_variable", `${label}: {{${key}}} は vars にも共通の文脈にも無い`);
  }

  return problems;
}

/**
 * vars の名前(varNames、D133)の問題: 全部の鍵に別名と説明・別名の形・vars に無い鍵の名前・名前の重なり。
 * 共通・enrichers と同じ鍵の値はその別名を書く。ほかの別名は見える名前(共通・enrichers・ほかの vars の鍵と別名)と重ならない
 */
function varNameProblems(
  definition: MessageDefinition<z.AnyZodObject>,
  label: string,
  throttle: boolean,
  embeddedNames: readonly { key: string; alias: string }[],
): MessageDefinitionProblem[] {
  const problems: MessageDefinitionProblem[] = [];
  const varKeys = Object.keys(definition.vars.shape);
  const names = (definition.varNames ?? {}) as Readonly<Record<string, { alias?: unknown; description?: unknown } | undefined>>;
  const visible = [
    ...MESSAGE_COMMON_EMBEDDED.filter((item) => !item.throttleOnly || throttle).map((item) => ({ key: item.key, alias: item.alias })),
    ...embeddedNames,
  ];
  for (const key of Object.keys(names)) {
    if (!varKeys.includes(key)) problems.push({ code: "invalid_var_name", message: `${label}: varNames の ${key} は vars に無い` });
  }
  const seen = new Map<string, string>();
  for (const key of varKeys) {
    const name = names[key];
    const alias = name?.alias;
    if (!name || typeof alias !== "string" || alias.trim() === "" || typeof name.description !== "string" || name.description.trim() === "") {
      problems.push({
        code: "missing_var_name",
        message: `${label}: vars の ${key} に日本語の別名と説明(varNames.${key} = { alias, description })を書く`,
      });
      continue;
    }
    if (!EMBEDDED_ALIAS_PATTERN.test(alias)) {
      problems.push({ code: "invalid_var_name", message: `${label}: vars の ${key} の別名 ${alias} は空白・記号を含まず、英数字以外の字を含めます` });
      continue;
    }
    const same = visible.find((entry) => entry.key === key && entry.alias);
    if (same) {
      if (same.alias !== alias) {
        problems.push({
          code: "var_name_clash",
          message: `${label}: vars の ${key} は共通・enrichers と同じ値なので別名は ${same.alias} にする(${alias} ではなく)`,
        });
      }
      continue;
    }
    const other = visible.find((entry) => entry.alias === alias || entry.key === alias) ?? (varKeys.includes(alias) ? { key: alias, alias } : undefined);
    const otherVar = seen.get(alias);
    if (other || otherVar) {
      problems.push({
        code: "var_name_clash",
        message: `${label}: vars の ${key} の別名 ${alias} は ${otherVar ?? other!.key} の名前と重なります`,
      });
      continue;
    }
    seen.set(alias, key);
  }
  return problems;
}

export type MessageCategoryProblem = {
  code: "unknown_kind" | "empty_channels" | "invalid_default_channels" | "unknown_group" | "group_kind_mismatch";
  message: string;
};

/**
 * 種類の受け口の検査(種類の override を重ねた後): 種別は 7 つのどれか・経路が 1 つ以上・defaultChannels は経路の中の 1 つ以上・
 * group はグループの受け口の鍵で、
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
    if (category.defaultChannels !== undefined) {
      const outside = category.defaultChannels.filter((channel) => !category.channels.includes(channel));
      if (category.defaultChannels.length === 0 || outside.length > 0) {
        problems.push({
          code: "invalid_default_channels",
          message: `種類 ${key}: defaultChannels は channels(${category.channels.join(" / ")})の中の 1 つ以上(${outside.join(", ") || "空"})`,
        });
      }
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
