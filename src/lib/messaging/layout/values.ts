// src/lib/messaging/layout/values.ts
//
// レイアウトの欄の中身の検査・送信チャンネルごとの欄・改版の対応。

import { z } from "zod";

import { layoutVersionOf, type MessageLayout, type MessageLayoutFields } from "./types";
import { fieldValueSchema, normalizeFieldValue, requiredValue, type MessageFieldSpec } from "./vocabulary";

/** 欄がその送信チャンネルのものか(channels が無い = 全部の送信チャンネル) */
export function fieldBelongsTo(spec: MessageFieldSpec, channel: string): boolean {
  return !spec.channels || spec.channels.includes(channel);
}

/**
 * 欄がその送り方で必須か: 宣言の required、または requiredFor のどれかが channels に入る(件名はメールを送る時だけ必須、D211)。
 * channels を渡さなければ宣言の required だけ。送る口の検査(layoutValuesSchema)・入力欄の印・プレビューの未入力の警告が同じこれを読む
 */
export function fieldRequiredIn(spec: Pick<MessageFieldSpec, "required" | "requiredFor">, channels?: readonly string[]): boolean {
  return Boolean(spec.required || (channels && spec.requiredFor?.some((channel) => channels.includes(channel))));
}

/** その送信チャンネルが使う欄だけ(宣言の順のまま) */
export function fieldsForChannel<F extends MessageLayoutFields>(layout: MessageLayout<F>, channel: string): Partial<F> {
  return Object.fromEntries(Object.entries(layout.fields).filter(([, spec]) => fieldBelongsTo(spec, channel))) as Partial<F>;
}

/**
 * 欄の中身の空を「無い」にする(D128): 欄ごとに normalizeFieldValue を通し、無い欄の鍵を外す。宣言に無い鍵はそのまま(検査が言う)。
 * object でない値はそのまま返す
 */
export function normalizeLayoutValues(fields: MessageLayoutFields, values: unknown): unknown {
  if (!values || typeof values !== "object" || Array.isArray(values)) return values;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    const spec = fields[key];
    const next = spec ? normalizeFieldValue(spec, value) : value;
    if (next !== undefined) out[key] = next;
  }
  return out;
}

/**
 * 欄の中身の zod(知らない鍵は通らない)。検査の前に空を「無い」にする(normalizeLayoutValues。parsed.data は整えた値)。
 * - channels を渡すと、その送信チャンネルのどれにも使われない送信チャンネルだけの欄は必須でなくなる(送らない送信チャンネルの欄を求めない)
 * - requiredFor の欄は、channels のどれかが requiredFor に入る時だけ必須(渡さなければ任意)
 * - 渡さなければ宣言の required のまま
 */
export function layoutValuesSchema(layout: MessageLayout, options: { channels?: readonly string[] } = {}) {
  const active = options.channels;
  const schema = z
    .object(
      Object.fromEntries(
        Object.entries(layout.fields).map(([key, spec]) => {
          const used = !active || active.some((channel) => fieldBelongsTo(spec, channel));
          const schema = fieldValueSchema(spec);
          return [key, fieldRequiredIn(spec, active) && used ? requiredValue(schema) : schema.optional()];
        }),
      ),
    )
    .strict();
  // 入力の型は欄の中身の object(フォームの resolver が FieldValues として読む)。整える前の値も同じ形
  return z.preprocess((values) => normalizeLayoutValues(layout.fields, values), schema) as unknown as z.ZodEffects<
    typeof schema,
    z.output<typeof schema>,
    Record<string, unknown>
  >;
}

/**
 * 改版の対応の 1 段を当てる: 前の版の欄の鍵を新しい版の鍵へ移し、null の鍵は捨てる。対応に無い鍵はそのまま。
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

/**
 * 保存した欄の中身(fromVersion の版で書いた値)を今の版へ読み替える(D122・D128)。fromVersion から今の版の 1 つ前まで、
 * 段ごとに revisions[版] を当てる。段の対応が無い・今より新しい版・版が正の整数でない = 読めない({ cannotRender: 理由 })
 */
export function upgradeLayoutValues(
  layout: MessageLayout,
  values: Readonly<Record<string, unknown>>,
  fromVersion: number,
): { values: Record<string, unknown> } | { cannotRender: string } {
  const current = layoutVersionOf(layout);
  if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > current) {
    return { cannotRender: `レイアウト「${layout.label}」の版 ${fromVersion} は読めません(今の版 ${current})` };
  }
  let out: Record<string, unknown> = { ...values };
  for (let version = fromVersion; version < current; version += 1) {
    const step = layout.revisions?.[version];
    if (!step) {
      return { cannotRender: `レイアウト「${layout.label}」の版 ${version} → ${version + 1} の改版の対応(revisions[${version}])がありません` };
    }
    out = applyLayoutRevisions(out, step);
  }
  return { values: out };
}
