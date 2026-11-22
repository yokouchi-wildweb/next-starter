// src/lib/messaging/definition/registry.ts
//
// 連絡の生成の一覧(src/registry/messageRegistry.ts、pnpm generate registry が書く)の型。
// 鍵 = <ドメインのフォルダ名>.<ファイル名>。定義・上書きは遅延 import(使う連絡だけを読む)。描き方はレイアウト(点 messagingLayouts)が持つ。

import type { z } from "zod";

import type { MessageDefinition, MessageKey, MessageOverride } from "./types";

/** 定義のモジュール(plugs/messages/<名前>.ts の export const message) */
export type MessageDefinitionModule = {
  message: MessageDefinition<z.AnyZodObject>;
};

/** 上書きのモジュール(plugs/messages/<名前>.override.ts の export const messageOverride) */
export type MessageOverrideModule = {
  messageOverride: MessageOverride;
};

/** 一覧の 1 項目 */
export type MessageRegistryEntry = {
  key: MessageKey;
  definition: () => Promise<MessageDefinitionModule>;
  /** 隣の <名前>.override.ts(fork が置いたときだけ) */
  override?: () => Promise<MessageOverrideModule>;
};

/** 連絡の一覧(鍵 → 項目) */
export type MessageRegistry = Readonly<Record<string, MessageRegistryEntry>>;
