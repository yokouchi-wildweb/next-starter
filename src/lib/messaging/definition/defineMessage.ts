// src/lib/messaging/definition/defineMessage.ts

import type { z } from "zod";

import type { ChannelFieldSchemas, UpstreamChannelFields } from "./channels";
import type { MessageDefinition } from "./types";

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
 * // messages/verification.ts(定義は export const message。pnpm check extensions が字面で読む)
 * export const message = defineMessage({
 *   key: "auth.verification",
 *   category: "emailVerification", // 種別と経路は種類(categories/<名前>.ts)から引く
 *   vars: z.object({ verificationUrl: z.string().url() }),
 *   required: true,
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
