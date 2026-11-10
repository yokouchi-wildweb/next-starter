// 生成物・編集不可: pnpm generate registry が src/features/**/messages/*.ts・*.override.ts・views/<名前>.tsx から生成する
// src/registry/messageRegistry.ts
//
// 連絡の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → 定義・上書き・描き方の遅延 import)。送る口・管理画面・プレビューが読む。型と決まり: src/lib/messaging/README.md

import "server-only";

import type { MessageRegistry } from "@/lib/messaging";

export const messageRegistry: MessageRegistry = {};
