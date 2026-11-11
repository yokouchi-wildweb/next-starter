// src/features/core/messaging/index.ts
//
// messaging ドメインの公開の定数と型。サーバーの処理は services/server(messagingService)から import する。

export * from "./constants";
export type { MessageDispatch } from "./entities/model";
