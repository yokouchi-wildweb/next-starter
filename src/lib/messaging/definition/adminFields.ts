// src/lib/messaging/definition/adminFields.ts
//
// 管理画面で直した欄の値(D21・D24・D28)の検査と重ね方。保存する口と送る口が同じ検査を使う(どちらも純粋な関数)。
// 欄の値が通る条件:
// - その欄が今も adminEditable(上書きを重ねた後の定義)にある
// - 欄の zod(経路の欄の束の shape[欄])を通る
// - コードの値が配列なら同じ長さ(描き方が段落を位置で読むため)
// - {{鍵}} は vars(秘密の印 secretVar の鍵を除く)∪ 共通の文脈 ∪ throttle の鍵 ∪ variableKeys(enrichers の provides)だけ
// 通らない欄(孤立)は重ねず、その欄だけコードの値のまま(空で送らない)。

import { listVariables } from "@/lib/structuredDocument/shared";
import type { z } from "zod";

import { UPSTREAM_CHANNEL_FIELDS, type ChannelFieldSchemas } from "./channels";
import { listSecretVarKeys } from "./secret";
import type { ResolvedMessageDefinition } from "./types";
import { COMMON_CONTEXT_KEYS, THROTTLE_CONTEXT_KEYS } from "./validate";

/** 管理画面の欄の値 1 つ(field_path = "<経路>.<欄>") */
export type AdminFieldValue = { fieldPath: string; value: unknown };

export type AdminFieldProblemCode = "not_editable" | "invalid_value" | "length_mismatch" | "unknown_variable";

export type AdminFieldProblem = { code: AdminFieldProblemCode; message: string };

export type AdminFieldCheckOptions = {
  /** 経路の欄の zod の束(既定 = 上流の 3 経路) */
  channels?: ChannelFieldSchemas;
  /** vars と共通の文脈の他に {{鍵}} で許す鍵(当たる enrichers の provides) */
  variableKeys?: readonly string[];
};

type AnyResolved = ResolvedMessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;

/** 管理画面の値で使ってよい {{鍵}}(秘密の vars は入れない) */
export function adminFieldAllowedKeys(resolved: AnyResolved, variableKeys: readonly string[] = []): string[] {
  const secret = new Set(listSecretVarKeys(resolved.vars));
  const varKeys = Object.keys(resolved.vars.shape).filter((key) => !secret.has(key));
  return [
    ...new Set([
      ...varKeys,
      ...COMMON_CONTEXT_KEYS,
      ...(resolved.throttle ? THROTTLE_CONTEXT_KEYS : []),
      ...variableKeys,
    ]),
  ];
}

/** 欄のコードの値(上書きを重ねた後の定義の content.<経路>.<欄>) */
export function adminFieldCodeValue(resolved: AnyResolved, fieldPath: string): unknown {
  const [channel, field] = fieldPath.split(".");
  const fields = (resolved.content as Record<string, Record<string, unknown> | undefined>)[channel];
  return fields?.[field];
}

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectStrings(item, out);
  return out;
}

/**
 * 欄の値を検査する。
 * @returns 問題(null = 通る)
 */
export function checkAdminFieldValue(
  resolved: AnyResolved,
  fieldPath: string,
  value: unknown,
  options: AdminFieldCheckOptions = {},
): AdminFieldProblem | null {
  const channels = options.channels ?? (UPSTREAM_CHANNEL_FIELDS as ChannelFieldSchemas);
  const label = `${resolved.key} ${fieldPath}`;
  if (!(resolved.adminEditable ?? []).some((path) => String(path) === fieldPath)) {
    return { code: "not_editable", message: `${label}: 管理画面で直せる欄ではありません` };
  }
  const [channel, field] = fieldPath.split(".");
  const shape = (channels[channel] as { shape?: Record<string, z.ZodTypeAny> } | undefined)?.shape;
  const schema = shape?.[field];
  if (!schema) {
    return { code: "not_editable", message: `${label}: 経路の欄にありません` };
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success || value === undefined) {
    const detail = parsed.success ? "値がありません" : parsed.error.issues.map((issue) => issue.message).join(" / ");
    return { code: "invalid_value", message: `${label}: 値の形が正しくありません(${detail})` };
  }
  const code = adminFieldCodeValue(resolved, fieldPath);
  if (Array.isArray(code) && (!Array.isArray(value) || value.length !== code.length)) {
    return { code: "length_mismatch", message: `${label}: 並びの数はコードと同じ ${code.length} にします` };
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

/**
 * 通る欄の値だけを定義に重ねる(経路ごとに欄を差し替える)。通らない欄はコードの値のまま rejected に返す。
 */
export function applyAdminFieldValues<R extends AnyResolved>(
  resolved: R,
  values: readonly AdminFieldValue[],
  options: AdminFieldCheckOptions = {},
): { resolved: R; rejected: (AdminFieldValue & { problem: AdminFieldProblem })[] } {
  const rejected: (AdminFieldValue & { problem: AdminFieldProblem })[] = [];
  const content: Record<string, Record<string, unknown>> = { ...(resolved.content as Record<string, Record<string, unknown>>) };
  let changed = false;
  for (const entry of values) {
    const problem = checkAdminFieldValue(resolved, entry.fieldPath, entry.value, options);
    if (problem) {
      rejected.push({ ...entry, problem });
      continue;
    }
    const [channel, field] = entry.fieldPath.split(".");
    content[channel] = { ...content[channel], [field]: entry.value };
    changed = true;
  }
  return { resolved: changed ? ({ ...resolved, content } as R) : resolved, rejected };
}
