// src/lib/messaging/definition/defineMessage.ts

import type { z } from "zod";

import type { ChannelFieldSchemas, UpstreamChannelFields } from "./channels";
import type { MessageDefinition, MessageOverride } from "./types";

/**
 * 経路の束を決めた defineMessage を作る(fork の経路を足した束は S6 の生成の一覧が渡す)。
 */
export function createDefineMessage<C extends ChannelFieldSchemas>() {
  return function defineMessage<Vars extends z.AnyZodObject>(
    definition: MessageDefinition<Vars, C>,
  ): MessageDefinition<Vars, C> {
    return definition;
  };
}

/**
 * 連絡の定義を書く(上流の経路 email・inApp・line)。型で鍵の形・欄の名前・throttle.by を絞るだけで、値はそのまま返す。
 *
 * @example
 * ```ts
 * export default defineMessage({
 *   key: "auth.verification",
 *   kind: "transactional",
 *   category: "account",
 *   vars: z.object({ verificationUrl: z.string().url() }),
 *   required: true,
 *   defaultChannels: ["email"],
 *   content: {
 *     email: {
 *       subject: "メールアドレスの確認",
 *       paragraphs: ["{{recipientName}} 様、以下のボタンを押して確認を完了してください。"],
 *       cta: { label: "確認する", url: "{{verificationUrl}}" },
 *     },
 *   },
 * });
 * ```
 */
export const defineMessage = createDefineMessage<UpstreamChannelFields>();

/**
 * 上書きを書く(messages/<名前>.override.ts)。型を当てるだけで、値はそのまま返す。
 */
export function defineMessageOverride<C extends ChannelFieldSchemas = UpstreamChannelFields>(
  override: MessageOverride<C>,
): MessageOverride<C> {
  return override;
}
