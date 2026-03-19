// src/lib/zod/getZodDefaults.ts

import type { z } from "zod";

/**
 * Zod の z.object() スキーマから .default() で指定されたデフォルト値を抽出する
 *
 * - .default() が指定されたフィールド → そのデフォルト値
 * - .nullish() / .nullable() / .optional() → undefined（省略）
 * - それ以外 → undefined（省略）
 *
 * @example
 * const schema = z.object({
 *   siteTitle: z.string().nullish(),
 *   perPage: z.number().default(50),
 *   tags: z.array(z.string()).default([]),
 * });
 * getZodDefaults(schema);
 * // => { perPage: 50, tags: [] }
 */
export function getZodDefaults<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
): Partial<z.infer<T>> {
  const shape = schema.shape;
  const defaults: Record<string, unknown> = {};

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const def = (fieldSchema as z.ZodTypeAny)._def;
    if (def.typeName === "ZodDefault") {
      defaults[key] = def.defaultValue();
    }
  }

  return defaults as Partial<z.infer<T>>;
}
