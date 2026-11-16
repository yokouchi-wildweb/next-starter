// src/lib/messaging/layout/values.ts
//
// ひな形の欄の中身の検査・経路ごとの欄・改版の対応。

import { z } from "zod";

import type { MessageLayout, MessageLayoutFields } from "./types";
import { fieldValueSchema, requiredValue, type MessageFieldSpec } from "./vocabulary";

/** 欄がその経路のものか(channels が無い = 全部の経路) */
export function fieldBelongsTo(spec: MessageFieldSpec, channel: string): boolean {
  return !spec.channels || spec.channels.includes(channel);
}

/** その経路が使う欄だけ(宣言の順のまま) */
export function fieldsForChannel<F extends MessageLayoutFields>(layout: MessageLayout<F>, channel: string): Partial<F> {
  return Object.fromEntries(Object.entries(layout.fields).filter(([, spec]) => fieldBelongsTo(spec, channel))) as Partial<F>;
}

/**
 * 欄の中身の zod(知らない鍵は通らない)。
 * - channels を渡すと、その経路のどれにも使われない経路だけの欄は必須でなくなる(送らない経路の欄を求めない)
 * - 渡さなければ宣言の required のまま
 */
export function layoutValuesSchema(layout: MessageLayout, options: { channels?: readonly string[] } = {}) {
  const active = options.channels;
  return z
    .object(
      Object.fromEntries(
        Object.entries(layout.fields).map(([key, spec]) => {
          const used = !active || active.some((channel) => fieldBelongsTo(spec, channel));
          const schema = fieldValueSchema(spec);
          return [key, spec.required && used ? requiredValue(schema) : schema.optional()];
        }),
      ),
    )
    .strict();
}

/**
 * 改版の対応を当てる: 前の版の欄の鍵を新しい版の鍵へ移し、null の鍵は捨てる。対応に無い鍵はそのまま。
 * 移し先に値が既にあれば今の値を残す(新しい版で書いた値を前の版の値で消さない)
 */
export function applyLayoutRevisions(
  values: Readonly<Record<string, unknown>>,
  revisions: Readonly<Record<string, string | null>> | undefined,
): Record<string, unknown> {
  if (!revisions) return { ...values };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!(key in revisions)) out[key] = value;
  }
  for (const [key, value] of Object.entries(values)) {
    if (!(key in revisions)) continue;
    const next = revisions[key];
    if (next === null || next === undefined) continue;
    if (!(next in out)) out[next] = value;
  }
  return out;
}
