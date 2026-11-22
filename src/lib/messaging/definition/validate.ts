// src/lib/messaging/definition/validate.ts
//
// 連絡定義の読み手の検査。定義(と上書きを重ねた結果)の誤りを問題の一覧で返す。
// 送る口が実行時に、registry の生成が生成時に呼ぶ(呼ぶ側は S2 / S6)。
// 種別と送信チャンネルは定義に無く、属するカテゴリー(category)から引く(D81・D86)。種別の性質(MESSAGE_KIND_TRAITS)で管理画面のテキストの編集・間引きを止める。
// 中身はレイアウト + 欄の中身(D122): レイアウトが受け口にあり、欄の中身がカテゴリーの送信チャンネルで使う欄の zod(layoutValuesSchema)を通り、{{鍵}} が宣言済み。

import { listVariables } from "@/lib/templateVariables";
import type { z } from "zod";

import { isLayoutUsable, type MessageLayout } from "../layout/types";
import { layoutValuesSchema } from "../layout/values";
import type { MessageCategory, MessageCategoryGroup } from "../receptacles/types";
import { MESSAGE_COMMON_VARS } from "../vars/common";
import { messageVarDeclarationSchema } from "../vars/declaration";
import { VAR_ALIAS_PATTERN } from "../vars/names";
import { definitionChannels } from "./channels";
import { MESSAGE_KIND_TRAITS, isMessageKind } from "./kinds";
import { isSecretVar } from "./secret";
import {
  MESSAGE_CHANNEL_MODES,
  MESSAGE_DEFINITION_ADMIN_TARGETS,
  type MessageDefinition,
  type MessageOverride,
  type ResolvedMessageDefinition,
} from "./types";

/**
 * どの連絡でも差し込める共通の文脈の鍵(送る口が埋める)。一覧(鍵・日本語の別名・説明)は vars/common.ts の 1 か所
 * - recipientName / recipientEmail: 受信者
 * - serviceName: サービスの名前(@/business)
 * - appBaseUrl: アプリの起点の URL(getAppBaseUrl)
 */
export const COMMON_CONTEXT_KEYS: readonly string[] = MESSAGE_COMMON_VARS.filter((item) => !item.throttleOnly).map((item) => item.key);

/** throttle のある連絡だけで差し込める鍵(まとめた回数) */
export const THROTTLE_CONTEXT_KEYS: readonly string[] = MESSAGE_COMMON_VARS.filter((item) => item.throttleOnly).map((item) => item.key);

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
  | "disabled_layout"
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
  | "var_name_clash"
  | "var_origin_overlap"
  | "unknown_var_origin"
  | "secret_admin_var"
  | "invalid_var_input"
  | "invalid_admin_target"
  | "unknown_channel_mode"
  | "channel_all_off"
  | "email_off_fixed";

export type MessageDefinitionProblem = {
  code: MessageDefinitionProblemCode;
  message: string;
};

/** 送信チャンネルの受け口を渡さない時の既定(上流の 3 送信チャンネル) */
const UPSTREAM_CHANNEL_KEYS: readonly string[] = ["email", "inApp", "line"];

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

/** 上書きを重ねた定義(カテゴリーから引く種別・送信チャンネルはまだ付けない) */
export type OverriddenMessageDefinition<Vars extends z.AnyZodObject> = MessageDefinition<Vars> & {
  enabled: boolean;
};

/**
 * 定義に上書きを重ねる。values はレイアウトの欄ごとに差し替え、throttle: null は外す。種別と送信チャンネルは resolveMessageDefinition がカテゴリーから付ける
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

/** 上書きを重ね、属するカテゴリー(category)から種別と送信チャンネルを付ける(D81・D86) */
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
 * - categories: categories の受け口(鍵 → 項目、fork のカテゴリーの override を重ねた後)。定義の category を照らし、種別と送信チャンネルを引く
 * - layouts: レイアウトの受け口(鍵 → レイアウト)。定義の layout を照らし、欄の中身を検査する
 * - channels: 登録された送信チャンネルの鍵(既定 = 上流の 3 送信チャンネル email・inApp・line。送る口は送信チャンネルの受け口の鍵を渡す)。送信チャンネルの有無だけに使う
 * - variableKeys: vars と共通の文脈(鍵・別名)の他に {{名前}} で許す名前(送る口が当たる enrichers の provides の鍵と別名を渡す)
 * - sharedVarNames: 共通の他にこの連絡で見える埋め込み情報の鍵と別名の組(当たる enrichers と、enricher と同じ鍵の vars)。vars の別名の重なりを照らす
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
    sharedVarNames?: readonly { key: string; alias: string }[];
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

  // カテゴリー(全部の連絡に必須、D81): 受け口に無い鍵は誤り。種別と送信チャンネルはカテゴリーから引く
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
      add("required_without_email", `${label}: required の連絡のカテゴリーの送信チャンネルに email が要る`);
    }
    if (resolved.adminEditableOnly && resolved.adminEditableOnly.length > 0) {
      add("required_admin_editable", `${label}: required の連絡に adminEditableOnly は付けられない`);
    }
    if (resolved.throttle) {
      add("required_throttle", `${label}: required の連絡に throttle は付けられない`);
    }
  }
  if (!traits.adminTextOverride && resolved.adminEditableOnly && resolved.adminEditableOnly.length > 0) {
    add("kind_admin_editable", `${label}: 種別 ${resolved.kind} の連絡は管理画面でテキストの編集ができない(adminEditableOnly を付けない)`);
  }
  if (!traits.throttle && resolved.throttle) {
    add("kind_throttle", `${label}: 種別 ${resolved.kind} の連絡は間引けない(throttle を付けない)`);
  }

  for (const channel of resolved.channels) {
    if (!channels.has(channel)) {
      add("unknown_channel", `${label}: カテゴリー ${definition.category} の送信チャンネル ${channel} は登録されていない`);
    }
  }
  problems.push(...channelModeProblems(resolved, label, traits.emailFixed));
  problems.push(...declarationProblems(definition, label));
  // レイアウトと欄の中身(D122・D125): カテゴリーの送信チャンネルで使う欄だけを検査する
  const values = (resolved.values ?? {}) as Record<string, unknown>;
  const layout = typeof definition.layout === "string" ? options.layouts[definition.layout] : undefined;
  if (!layout) {
    const keys = Object.keys(options.layouts);
    add("unknown_layout", `${label}: layout ${String(definition.layout)} は layouts の受け口に無い(${keys.join(" / ") || "項目なし"})`);
  } else if (!isLayoutUsable(layout)) {
    // 無効のレイアウト(fork の layout.override.ts の disabled)を定義連絡は使えない。定義をほかのレイアウトに移すか disabled を外す
    add("disabled_layout", `${label}: layout ${layout.key}(${layout.label})は無効(disabled)。定義をほかのレイアウトに移すか、layouts/${layout.key}/layout.override.ts の disabled を外す`);
  } else {
    const parsed = layoutValuesSchema(layout, { channels: resolved.channels }).safeParse(values);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(全体)"}: ${issue.message}`)
        .join(" / ");
      add("invalid_values", `${label}: レイアウト「${layout.label}」の欄の中身が正しくない(${detail})`);
    }
  }

  // adminEditableOnly = レイアウトの欄の鍵(D132)。レイアウトに無い欄は誤り(レイアウトが無い時は上の unknown_layout が言う)
  if (layout) {
    for (const key of resolved.adminEditableOnly ?? []) {
      if (!(String(key) in layout.fields)) {
        add("unknown_admin_editable", `${label}: adminEditableOnly の ${String(key)} はレイアウト「${layout.label}」の欄に無い`);
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

  problems.push(...varNameProblems(definition, label, resolved.throttle ? true : false, options.sharedVarNames ?? []));
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
    ...MESSAGE_COMMON_VARS.filter((item) => !item.throttleOnly || resolved.throttle).map((item) => item.alias),
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
 * 送信チャンネルの固定(channelModes、D212)の問題: カテゴリーの送信チャンネルの外・知らない値・全部 off・
 * required(D195)か email を外せない種別(emailFixed)の email を off。上書きを重ねた後の定義で見る
 */
function channelModeProblems(
  resolved: Pick<ResolvedMessageDefinition, "channels" | "channelModes" | "required" | "kind" | "category">,
  label: string,
  emailFixed: boolean,
): MessageDefinitionProblem[] {
  const problems: MessageDefinitionProblem[] = [];
  const modes = resolved.channelModes ?? {};
  for (const [channel, mode] of Object.entries(modes)) {
    if (!resolved.channels.includes(channel)) {
      problems.push({ code: "unknown_channel_mode", message: `${label}: channelModes の ${channel} はカテゴリー ${resolved.category} の送信チャンネル(${resolved.channels.join(" / ")})に無い` });
    } else if (!(MESSAGE_CHANNEL_MODES as readonly string[]).includes(mode)) {
      problems.push({ code: "unknown_channel_mode", message: `${label}: channelModes の ${channel} は on / off / free のどれか(${String(mode)})` });
    }
  }
  const split = definitionChannels(resolved);
  if (resolved.channels.length > 0 && split.on.length + split.free.length === 0) {
    problems.push({ code: "channel_all_off", message: `${label}: channelModes で送信チャンネルが全部 off(送れない)` });
  }
  if (split.off.includes("email") && (resolved.required || emailFixed)) {
    problems.push({
      code: "email_off_fixed",
      message: `${label}: ${resolved.required ? "required の連絡" : `種別 ${resolved.kind} の連絡`}は email を off にできない`,
    });
  }
  return problems;
}

/**
 * 管理者が送る時の宣言(D175・D195)の問題: adminVars / recordVars の鍵が vars に無い・両方にある・秘密の値を管理者が入れる・
 * 入力の型の形(選択肢は options が要る、既定値が型の形)/ adminTargets が records・all・role・group の外
 */
function declarationProblems(definition: MessageDefinition<z.AnyZodObject>, label: string): MessageDefinitionProblem[] {
  const problems: MessageDefinitionProblem[] = [];
  const shape = definition.vars.shape as Readonly<Record<string, z.ZodTypeAny>>;
  const admin = (definition.adminVars ?? {}) as Readonly<Record<string, unknown>>;
  const record = (definition.recordVars ?? {}) as Readonly<Record<string, unknown>>;
  for (const [field, map] of [
    ["adminVars", admin],
    ["recordVars", record],
  ] as const) {
    for (const [key, input] of Object.entries(map)) {
      if (!(key in shape)) {
        problems.push({ code: "unknown_var_origin", message: `${label}: ${field} の ${key} は vars に無い` });
        continue;
      }
      if (field === "adminVars" && isSecretVar(shape[key]!)) {
        problems.push({ code: "secret_admin_var", message: `${label}: 秘密の値 ${key}(secretVar)は管理者が入れられない(adminVars に書かない)` });
      }
      const parsed = messageVarDeclarationSchema.safeParse({ key, alias: "別名", ...(input as object) });
      if (!parsed.success) {
        const detail = parsed.error.issues.map((issue) => issue.message).join(" / ");
        problems.push({ code: "invalid_var_input", message: `${label}: ${field} の ${key} の入力の型が正しくない(${detail})` });
      }
    }
  }
  for (const key of Object.keys(admin)) {
    if (key in record) {
      problems.push({ code: "var_origin_overlap", message: `${label}: vars の ${key} が adminVars と recordVars の両方にある(管理者が入れるか記録から引くかのどちらか 1 つ)` });
    }
  }
  for (const target of definition.adminTargets ?? []) {
    if (!(MESSAGE_DEFINITION_ADMIN_TARGETS as readonly string[]).includes(target)) {
      problems.push({ code: "invalid_admin_target", message: `${label}: adminTargets の ${String(target)} は records / all / role / group のどれか` });
    }
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
  sharedVarNames: readonly { key: string; alias: string }[],
): MessageDefinitionProblem[] {
  const problems: MessageDefinitionProblem[] = [];
  const varKeys = Object.keys(definition.vars.shape);
  const names = (definition.varNames ?? {}) as Readonly<Record<string, { alias?: unknown; description?: unknown } | undefined>>;
  const visible = [
    ...MESSAGE_COMMON_VARS.filter((item) => !item.throttleOnly || throttle).map((item) => ({ key: item.key, alias: item.alias })),
    ...sharedVarNames,
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
    if (!VAR_ALIAS_PATTERN.test(alias)) {
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
 * カテゴリーの受け口の検査(カテゴリーの override を重ねた後): 種別は 7 つのどれか・送信チャンネルが 1 つ以上・defaultChannels は送信チャンネルの中の 1 つ以上・
 * group はグループの受け口の鍵で、
 * 1 つのグループのカテゴリーは同じ種別(D82)
 */
export function validateMessageCategories(
  categories: Readonly<Record<string, MessageCategory>>,
  groups: Readonly<Record<string, MessageCategoryGroup>> = {},
): MessageCategoryProblem[] {
  const problems: MessageCategoryProblem[] = [];
  const kindOfGroup = new Map<string, { kind: string; category: string }>();
  for (const [key, category] of Object.entries(categories)) {
    if (!isMessageKind(category.kind)) problems.push({ code: "unknown_kind", message: `カテゴリー ${key}: 種別 ${String(category.kind)} は無い` });
    if (!Array.isArray(category.channels) || category.channels.length === 0) {
      problems.push({ code: "empty_channels", message: `カテゴリー ${key}: 送信チャンネルが無い(channels に 1 つ以上)` });
    }
    if (category.defaultChannels !== undefined) {
      const outside = category.defaultChannels.filter((channel) => !category.channels.includes(channel));
      if (category.defaultChannels.length === 0 || outside.length > 0) {
        problems.push({
          code: "invalid_default_channels",
          message: `カテゴリー ${key}: defaultChannels は channels(${category.channels.join(" / ")})の中の 1 つ以上(${outside.join(", ") || "空"})`,
        });
      }
    }
    if (category.group === undefined) continue;
    if (!groups[category.group]) {
      problems.push({ code: "unknown_group", message: `カテゴリー ${key}: group ${category.group} は categoryGroups の受け口に無い` });
      continue;
    }
    const seen = kindOfGroup.get(category.group);
    if (!seen) kindOfGroup.set(category.group, { kind: category.kind, category: key });
    else if (seen.kind !== category.kind) {
      problems.push({
        code: "group_kind_mismatch",
        message: `カテゴリー ${key}: グループ ${category.group} には種別 ${seen.kind} のカテゴリー(${seen.category})があり、種別 ${category.kind} は入れられない`,
      });
    }
  }
  return problems;
}
