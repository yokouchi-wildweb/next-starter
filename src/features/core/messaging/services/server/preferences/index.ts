// src/features/core/messaging/services/server/preferences/index.ts
//
// 好みの service の結び(本物の部品)。/api/me/messaging/preferences と user の退会の後片付けが呼ぶ。

import { gate } from "@/featureGate";
import type { DbTransaction } from "@/lib/crud/drizzle/types";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";
import { drizzleMessageSendStore } from "../sendMessage/store";
import { createPreferenceService } from "./preferenceService";
import { drizzleMessagePreferenceStore } from "./store";

/** 案内先が開いているか: サイト内のパスは門で見る(クエリは外す)、外の URL はそのまま */
function isHrefOpen(href: string): boolean {
  if (!href.startsWith("/")) return true;
  return gate.path(href.split(/[?#]/)[0]).open;
}

const service = createPreferenceService({
  store: drizzleMessagePreferenceStore,
  categories,
  channels,
  findLedgerEndpoints: (channel, userIds) => drizzleMessageSendStore.findActiveEndpoints(channel, userIds),
  isHrefOpen,
});

export const getMessagePreferences = service.getPreferences;
export const setMessagePreference = service.setPreference;

/** 退会の後片付け: 利用者の好みの行を全部消す(user の cleanupHandlers の項目が呼ぶ) */
export function deletePreferencesOfUser(userId: string, tx: DbTransaction): Promise<void> {
  return drizzleMessagePreferenceStore.deleteAllOfUser(userId, tx);
}

export { createPreferenceService, preferenceVia, PREFERENCE_USER_SOURCE } from "./preferenceService";
export type { PreferenceService, PreferenceServiceDeps } from "./preferenceService";
export { SetMessagePreferenceInputSchema } from "./schema";
export type * from "./dto";
export type { MessagePreferenceRow, MessagePreferenceStore } from "./types";
