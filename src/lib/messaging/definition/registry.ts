// src/lib/messaging/definition/registry.ts
//
// 連絡の生成の一覧(src/registry/messageRegistry.ts、pnpm generate registry が書く)の型。
// 鍵 = <ドメインのフォルダ名>.<ファイル名>。定義・上書き・描き方は遅延 import(使う連絡だけを読む)。

import type { z } from "zod";

import type { ChannelFieldSchemas } from "./channels";
import type { MessageEmailViewModule } from "./emailView";
import type { MessageDefinition, MessageKey, MessageOverride } from "./types";

/** 定義のモジュール(messages/<名前>.ts の export const message) */
export type MessageDefinitionModule = {
  message: MessageDefinition<z.AnyZodObject, ChannelFieldSchemas>;
};

/** 上書きのモジュール(messages/<名前>.override.ts の export const messageOverride) */
export type MessageOverrideModule = {
  messageOverride: MessageOverride<ChannelFieldSchemas>;
};

/** 一覧の 1 項目 */
export type MessageRegistryEntry = {
  key: MessageKey;
  definition: () => Promise<MessageDefinitionModule>;
  /** 隣の <名前>.override.ts(fork が置いたときだけ) */
  override?: () => Promise<MessageOverrideModule>;
  /** messages/views/<名前>.tsx(メールの描き方の 1 行スイッチ。形 = MessageEmailViewModule: export する EmailView) */
  view?: () => Promise<MessageEmailViewModule>;
};

/** 連絡の一覧(鍵 → 項目) */
export type MessageRegistry = Readonly<Record<string, MessageRegistryEntry>>;
