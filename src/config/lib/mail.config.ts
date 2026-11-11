// src/config/lib/mail.config.ts
// メール送信の設定の上書き(@lib-config/mail)。値はリテラルか @/business の値。キーと既定: src/lib/mail/config.ts
// 上流は事業の素性の差出人を写す(差出人は src/business/business.ts の mail で変える)
import { business } from "@/business";
import type { MailOverride } from "@/lib/mail";

export default {
  defaultFrom: business.mail.defaultFrom,
  defaultFromName: business.mail.defaultFromName,
} satisfies MailOverride;
