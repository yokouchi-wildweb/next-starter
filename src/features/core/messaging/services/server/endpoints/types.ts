// src/features/core/messaging/services/server/endpoints/types.ts

import type { DbTransaction } from "@/lib/crud/drizzle/types";

import type { MessageEndpoint, MessageEndpointInsert } from "../../../entities/model";

/** 端末の帳簿の DB の読み書き(テストは偽物を渡す) */
export type MessageEndpointStore = {
  findByChannelAddress: (channel: string, address: string) => Promise<MessageEndpoint | null>;
  insert: (values: MessageEndpointInsert) => Promise<MessageEndpoint>;
  update: (id: string, patch: Partial<MessageEndpointInsert>) => Promise<MessageEndpoint>;
  /** 本人の行を消す(消した行が無ければ false) */
  deleteOwn: (userId: string, id: string) => Promise<boolean>;
  listOwn: (userId: string) => Promise<MessageEndpoint[]>;
  deleteAllOfUser: (userId: string, tx: DbTransaction) => Promise<void>;
};
