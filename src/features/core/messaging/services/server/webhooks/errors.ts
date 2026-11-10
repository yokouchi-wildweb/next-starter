// src/features/core/messaging/services/server/webhooks/errors.ts

/** provider の webhook の鍵(env)が置かれていない。受け口は 503 を返す(provider は後で送り直す) */
export class WebhookNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`webhook の鍵が設定されていません: ${provider}`);
    this.name = "WebhookNotConfiguredError";
  }
}
