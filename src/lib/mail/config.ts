// src/lib/mail/config.ts
//
// メール送信の設定(既定 + 上書き)。上書きは src/config/lib/mail.config.ts(@lib-config/mail)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 上流の上書きは事業の素性の差出人(@/business の mail)を写す。lib は @/business を直に読まない(閉じた lib の決まり)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/mail";

export type MailConfig = {
  /** 既定の送信元アドレス(send の from を省いたとき) */
  defaultFrom: string;
  /** 既定の送信者名(send の fromName を省いたとき) */
  defaultFromName: string;
};

const defaults: MailConfig = {
  defaultFrom: "noreply@example.com",
  defaultFromName: "next-starter",
};

export const mailConfigDef = defineConfig(defaults, { label: "mail" });

/** 上書きのファイルの型(`export default { ... } satisfies MailOverride`) */
export type MailOverride<E extends object = Record<never, never>> = OverrideOf<typeof mailConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const mailConfig: MailConfig = mailConfigDef.compose(override);
