// src/domains/core/messaging/services/server/webhooks/errors.ts

import { BackendNotConfiguredError } from "@/lib/errors";

/** provider ごとの webhook の鍵の env 名(読むのは email チャンネルの webhookKeys。ここは誤りの欄 missing の名前だけ) */
const WEBHOOK_KEY_ENV_NAME: Record<string, string> = {
  resend: "RESEND_WEBHOOK_SECRET",
  sendgrid: "SENDGRID_WEBHOOK_PUBLIC_KEY",
};

/**
 * provider の webhook の鍵(env)が置かれていない。受け口は 503 を返す(provider は後で送り直す)。
 * 共通の親 BackendNotConfiguredError を継ぐ(port "mail"、implementation = provider、missing = その鍵の env 名)
 */
export class WebhookNotConfiguredError extends BackendNotConfiguredError {
  constructor(provider: string) {
    const envName = WEBHOOK_KEY_ENV_NAME[provider];
    super(`webhook の鍵が設定されていません: ${provider}`, {
      port: "mail",
      implementation: provider,
      missing: envName ? [envName] : [],
      side: "server",
    });
    this.name = "WebhookNotConfiguredError";
  }
}
