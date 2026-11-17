// src/lib/messaging/definition/defineMessage.ts

import type { z } from "zod";

import type { MessageDefinition } from "./types";

/**
 * 連絡の定義を書く。型で鍵の形・throttle.by を絞るだけで、値はそのまま返す。
 * 中身はひな形 + 欄の中身(D122)。経路は属する種類(category)から引く(D86)。
 *
 * @example
 * ```ts
 * // messages/verification.ts(定義は export const message。pnpm check extensions が字面で読む)
 * export const message = defineMessage({
 *   key: "auth.verification",
 *   label: "メールアドレスの確認",
 *   category: "emailVerification", // 種別と経路は種類(categories/<名前>.ts)から引く
 *   vars: z.object({ verificationUrl: secretVar(z.string().url()) }),
 *   // vars の鍵ごとの日本語の別名と説明(全部の鍵に必須、D133)。{{確認のURL}} でも {{verificationUrl}} と同じ値で埋まる
 *   varNames: { verificationUrl: { alias: "確認のURL", description: "メールアドレスを確かめるリンク" } },
 *   required: true,
 *   layout: "link",
 *   values: { subject: "メールアドレスの確認", heading: "確認のお願い", received: "{{受信者名}} 様、…", button: { label: "確認する", url: "{{verificationUrl}}" } },
 * });
 * ```
 */
export function defineMessage<Vars extends z.AnyZodObject>(definition: MessageDefinition<Vars>): MessageDefinition<Vars> {
  return definition;
}
