// src/features/messaging/index.ts
//
// messaging ドメインの公開 API 集約点。
// サーバーロジック本体は services/server から個別 import すること
// （Hook / コンポーネントから直接 messagingService.send() を呼ばないため、
//  ここではあえて再エクスポートしない）。

export * from "./constants";
export type {
  MessageDispatch,
  MessagingBulkSendInput,
  MessagingBulkSendResult,
  MessagingChannelResult,
  MessagingRecipientResult,
  MessagingSendInput,
  MessagingSendResult,
} from "./entities/model";
