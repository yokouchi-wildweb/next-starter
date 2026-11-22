// src/lib/messaging/definition/adminFields.ts
//
// 管理画面で直した欄の値(テキストの編集、D21・D24・D28・D132)の検査と重ね方。保存する口・送る口・プレビューが同じ関数を使う(どれも純粋な関数)。
// - 欄の道(fieldPath)= レイアウトの欄の鍵。組・並び・ブロックの並びの欄は欄ごと丸ごと差し替える(中の 1 つだけは持たない)
// - 直せる欄 = レイアウトの欄のうちカテゴリーの送信チャンネル(上書きの後)で使う物の全部(送信チャンネルだけの欄は、その送信チャンネルがカテゴリーにある時だけ)。
//   定義の adminEditableOnly(欄の鍵の並び)があればその中だけ。種別の性質 adminTextOverride が false・required の連絡は無い
// - 行はレイアウトの版(layoutVersion)を持ち、読む時に改版の対応(revisions)で今の版の欄へ移す。移せない行(欄が消えた・段の対応が無い・
//   版の無い古い形の行)は当てない = unusable(行は消さない)
// 欄の値が通る条件:
// - 今の版へ移した欄が直せる欄にある
// - 欄の宣言の zod(lib の語彙 fieldValueSchema。必須の欄は空にできない)を通る
// - {{鍵}} は vars の鍵と別名(秘密の印 secretVar の鍵を除く)∪ 共通の文脈 ∪ throttle の鍵 ∪ variableKeys(enrichers の provides)だけ

import { listVariables } from "@/lib/templateVariables";
import type { z } from "zod";

import { layoutVersionOf, type MessageLayout } from "../layout/types";
import { fieldBelongsTo, upgradeLayoutValues } from "../layout/values";
import { fieldValueSchema, requiredValue } from "../layout/vocabulary";
import { MESSAGE_KIND_TRAITS } from "./kinds";
import { listSecretVarKeys } from "./secret";
import type { ResolvedMessageDefinition } from "./types";
import { MESSAGE_COMMON_VARS } from "../vars/common";
import { COMMON_CONTEXT_KEYS, THROTTLE_CONTEXT_KEYS } from "./validate";

/** 管理画面の欄の値 1 つ(fieldPath = レイアウトの欄の鍵、layoutVersion = 保存した時のレイアウトの版。null = 版の無い古い形の行) */
export type AdminFieldValue = { fieldPath: string; value: unknown; layoutVersion: number | null };

export type AdminFieldProblemCode = "not_editable" | "invalid_value" | "unknown_variable" | "unusable";

export type AdminFieldProblem = { code: AdminFieldProblemCode; message: string };

export type AdminFieldCheckOptions = {
  /** vars と共通の文脈の他に {{鍵}} で許す鍵(当たる enrichers の provides) */
  variableKeys?: readonly string[];
};

type AnyResolved = ResolvedMessageDefinition<z.AnyZodObject>;

/**
 * 管理画面で直せる欄(レイアウトの欄の鍵、宣言の順)。レイアウトの欄のうちカテゴリーの送信チャンネルで使う物の全部、adminEditableOnly があればその中だけ。
 * 種別の性質 adminTextOverride が false・required の連絡は空
 */
export function adminEditableFields(resolved: AnyResolved, layout: MessageLayout): string[] {
  if (resolved.required) return [];
  if (!MESSAGE_KIND_TRAITS[resolved.kind]?.adminTextOverride) return [];
  const only = resolved.adminEditableOnly ? new Set(resolved.adminEditableOnly.map(String)) : null;
  const channels = resolved.channels as readonly string[];
  return Object.entries(layout.fields)
    .filter(([key, spec]) => channels.some((channel) => fieldBelongsTo(spec, channel)) && (!only || only.has(key)))
    .map(([key]) => key);
}

/** 管理画面の値で使ってよい {{鍵}} / {{別名}}(vars は鍵と別名、秘密の vars は入れない。variableKeys = 当たる enrichers の鍵と別名) */
export function adminFieldAllowedKeys(resolved: AnyResolved, variableKeys: readonly string[] = []): string[] {
  const secret = new Set(listSecretVarKeys(resolved.vars));
  const varKeys = Object.keys(resolved.vars.shape).filter((key) => !secret.has(key));
  // vars の日本語の別名(D133、秘密の値の別名は入れない)
  const names = (resolved.varNames ?? {}) as Readonly<Record<string, { alias?: string } | undefined>>;
  const varAliases = varKeys.flatMap((key) => (names[key]?.alias ? [names[key]!.alias!] : []));
  return [
    ...new Set([
      ...varKeys,
      ...varAliases,
      ...COMMON_CONTEXT_KEYS,
      ...(resolved.throttle ? THROTTLE_CONTEXT_KEYS : []),
      // 共通の埋め込み情報の日本語の別名(D126。送る口が鍵と同じ値で埋める)
      ...MESSAGE_COMMON_VARS.filter((item) => !item.throttleOnly || resolved.throttle).map((item) => item.alias),
      ...variableKeys,
    ]),
  ];
}

/** 欄のコードの値(定義の values の欄、fork の override を重ねた後。無ければ undefined) */
export function adminFieldCodeValue(resolved: AnyResolved, fieldPath: string): unknown {
  return (resolved.values as Record<string, unknown> | undefined)?.[fieldPath];
}

/**
 * 保存した行の欄の道を今の版へ移す(改版の対応 revisions を段ごとに当てる)。
 * @returns 今の版の欄の鍵 / 移せない理由(版の無い古い形の行・段の対応が無い・欄が捨てられた・今の版に無い欄)
 */
export function moveAdminFieldPath(
  layout: MessageLayout,
  fieldPath: string,
  layoutVersion: number | null,
): { fieldPath: string } | { unusable: string } {
  if (layoutVersion === null) return { unusable: `${fieldPath} はレイアウトの版を持たない古い形の行です(使えません)` };
  const moved = upgradeLayoutValues(layout, { [fieldPath]: true }, layoutVersion);
  if ("cannotRender" in moved) return { unusable: moved.cannotRender };
  const [next] = Object.keys(moved.values);
  if (!next) return { unusable: `${fieldPath} はレイアウト「${layout.label}」の今の版(${layoutVersionOf(layout)})で捨てられた欄です` };
  if (!(next in layout.fields)) return { unusable: `${next} はレイアウト「${layout.label}」の欄にありません` };
  return { fieldPath: next };
}

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * 欄の値を検査する(fieldPath = 今の版の欄の鍵)。
 * @returns 問題(null = 通る)
 */
export function checkAdminFieldValue(
  resolved: AnyResolved,
  layout: MessageLayout,
  fieldPath: string,
  value: unknown,
  options: AdminFieldCheckOptions = {},
): AdminFieldProblem | null {
  const label = `${resolved.key} ${fieldPath}`;
  if (!adminEditableFields(resolved, layout).includes(fieldPath)) {
    return { code: "not_editable", message: `${label}: 管理画面で直せる欄ではありません` };
  }
  const spec = layout.fields[fieldPath]!;
  const schema = spec.required ? requiredValue(fieldValueSchema(spec)) : fieldValueSchema(spec);
  const parsed = schema.safeParse(value);
  if (!parsed.success || value === undefined) {
    const detail = parsed.success ? "値がありません" : parsed.error.issues.map((issue) => issue.message).join(" / ");
    return { code: "invalid_value", message: `${label}: 値の形が正しくありません(${detail})` };
  }
  const allowed = new Set(adminFieldAllowedKeys(resolved, options.variableKeys));
  const unknown = [...new Set(collectStrings(value, []).flatMap((text) => listVariables(text)))].filter(
    (key) => !allowed.has(key),
  );
  if (unknown.length > 0) {
    return {
      code: "unknown_variable",
      message: `${label}: 使えない差し込み ${unknown.map((key) => `{{${key}}}`).join(", ")}`,
    };
  }
  return null;
}

/** 行 1 つを読んだ結果: 今の版の欄の道と、当てられない理由(null = 当てる) */
export type AdminFieldReading = { row: AdminFieldValue; fieldPath: string | null; problem: AdminFieldProblem | null };

/** 行 1 つを今の版へ移して検査する(移せない = unusable、検査の誤り = その符号) */
export function readAdminFieldValue(
  resolved: AnyResolved,
  layout: MessageLayout,
  row: AdminFieldValue,
  options: AdminFieldCheckOptions = {},
): AdminFieldReading {
  const moved = moveAdminFieldPath(layout, row.fieldPath, row.layoutVersion);
  if ("unusable" in moved) {
    return { row, fieldPath: null, problem: { code: "unusable", message: `${resolved.key} ${row.fieldPath}: ${moved.unusable}` } };
  }
  return { row, fieldPath: moved.fieldPath, problem: checkAdminFieldValue(resolved, layout, moved.fieldPath, row.value, options) };
}

/**
 * 管理画面の値を定義の values に欄ごとに重ねる(送る口・プレビュー)。移せない・検査を通らない行は当てずコードの値のまま(rejected で返す)
 */
export function applyAdminFieldValues<R extends AnyResolved>(
  resolved: R,
  layout: MessageLayout,
  rows: readonly AdminFieldValue[],
  options: AdminFieldCheckOptions = {},
): { resolved: R; applied: string[]; rejected: { fieldPath: string; problem: AdminFieldProblem }[] } {
  const values: Record<string, unknown> = { ...((resolved.values as Record<string, unknown> | undefined) ?? {}) };
  const applied: string[] = [];
  const rejected: { fieldPath: string; problem: AdminFieldProblem }[] = [];
  for (const row of rows) {
    const reading = readAdminFieldValue(resolved, layout, row, options);
    if (reading.problem || !reading.fieldPath) {
      rejected.push({ fieldPath: row.fieldPath, problem: reading.problem! });
      continue;
    }
    values[reading.fieldPath] = row.value;
    applied.push(reading.fieldPath);
  }
  return { resolved: applied.length > 0 ? ({ ...resolved, values } as R) : resolved, applied, rejected };
}
