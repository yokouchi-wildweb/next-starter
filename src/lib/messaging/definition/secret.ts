// src/lib/messaging/definition/secret.ts
//
// vars の秘密の印。印の付いた鍵を差し込む連絡は、描いた本文をどこにも残さず(record が full でも)、
// vars の写しからその鍵を落とす(送る口が守る)。vars は上書きできないので印は外せない。

import type { z } from "zod";

const SECRET_SCHEMAS = new WeakSet<z.ZodTypeAny>();

/**
 * vars の 1 つの値に秘密の印を付ける(トークン入りの URL・ワンタイムコードなど)。値の型はそのまま。
 *
 * @example
 * ```ts
 * vars: z.object({ resetUrl: secretVar(z.string().url()) })
 * ```
 */
export function secretVar<T extends z.ZodTypeAny>(schema: T): T {
  SECRET_SCHEMAS.add(schema);
  return schema;
}

/** 包み(optional・nullable・default・effects など)の内側を 1 段返す。包みでなければ null */
function unwrapOnce(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const def = (schema as { _def?: Record<string, unknown> })._def;
  if (!def) return null;
  const inner = def.innerType ?? def.schema ?? def.in;
  return inner && typeof inner === "object" ? (inner as z.ZodTypeAny) : null;
}

/** 値の zod が秘密の印を持つか(後から .optional() などで包んでも内側の印を見る) */
export function isSecretVar(schema: z.ZodTypeAny): boolean {
  let current: z.ZodTypeAny | null = schema;
  for (let depth = 0; current && depth < 10; depth += 1) {
    if (SECRET_SCHEMAS.has(current)) return true;
    current = unwrapOnce(current);
  }
  return false;
}

/** vars の zod object のうち秘密の印を持つ鍵の一覧 */
export function listSecretVarKeys(vars: z.AnyZodObject): string[] {
  return Object.entries(vars.shape as Record<string, z.ZodTypeAny>)
    .filter(([, schema]) => isSecretVar(schema))
    .map(([key]) => key);
}
