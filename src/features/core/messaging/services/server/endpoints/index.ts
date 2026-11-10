// src/features/core/messaging/services/server/endpoints/index.ts
//
// 端末の帳簿の service の結び(本物の部品)。

import type { DbTransaction } from "@/lib/crud/drizzle/types";

import { channels } from "../../../extensions/channels";
import { createEndpointService } from "./endpointService";
import { drizzleMessageEndpointStore } from "./store";

const service = createEndpointService({ store: drizzleMessageEndpointStore, channels, now: () => new Date() });

export const registerEndpoint = service.registerEndpoint;
export const removeEndpoint = service.removeEndpoint;
export const listEndpoints = service.listEndpoints;

/** 退会の後片付け: 利用者の端末の帳簿を全部消す(user の cleanupHandlers の項目が呼ぶ) */
export function deleteEndpointsOfUser(userId: string, tx: DbTransaction): Promise<void> {
  return drizzleMessageEndpointStore.deleteAllOfUser(userId, tx);
}

export { createEndpointService, isLedgerChannel, toEndpointDto } from "./endpointService";
export type { EndpointService } from "./endpointService";
export { RegisterMessageEndpointInputSchema } from "./schema";
export type { MessageEndpointDto, RegisterMessageEndpointInput } from "./schema";
