// src/features/chatRoom/utils/metadata.ts
//
// メッセージメタデータの型安全な読み取りユーティリティ。
// ダウンストリームがコアの MessageMetadata を変更せずに、
// 独自のメタデータ構造を Zod スキーマで安全に取り出せる。

import type { z, ZodType } from "zod";

import type { ChatMessage } from "@/features/chatRoom/entities/message";

/**
 * メッセージの metadata を Zod スキーマでバリデーションし、型付きで返す。
 * metadata が null またはスキーマに合致しない場合は null を返す。
 *
 * @example
 * ```ts
 * // ダウンストリーム側
 * const ScoutMetadataSchema = z.object({
 *   linkedResources: z.array(z.object({
 *     type: z.string(),
 *     id: z.string(),
 *     url: z.string(),
 *     title: z.string().optional(),
 *   })),
 * });
 *
 * const scout = getTypedMetadata(message, ScoutMetadataSchema);
 * // scout: { linkedResources: { type, id, url, title? }[] } | null
 * ```
 */
export function getTypedMetadata<T extends ZodType>(
  message: ChatMessage,
  schema: T,
): z.infer<T> | null {
  if (!message.metadata) return null;
  const result = schema.safeParse(message.metadata);
  return result.success ? result.data : null;
}
