// src/features/core/messaging/channels/email/loadView.ts
//
// 連絡の鍵 → 生成の一覧の描き方(messages/views/<名前>.tsx の EmailView)。
// 一覧に鍵が無い・描き方が無い = null(既定の描き方)。EmailView が関数でない = コードの誤り → 投げる(経路は permanent にする)

import type { MessageRegistry } from "@/lib/messaging";

import type { EmailViewComponent } from "./view";

export async function loadRegistryView(registry: MessageRegistry, messageKey: string): Promise<EmailViewComponent | null> {
  const entry = registry[messageKey];
  if (!entry?.view) return null;
  const loaded = await entry.view();
  if (typeof loaded.EmailView !== "function") {
    throw new Error(`連絡 ${messageKey} の描き方(messages/views)が EmailView を export していません`);
  }
  return loaded.EmailView as unknown as EmailViewComponent;
}
