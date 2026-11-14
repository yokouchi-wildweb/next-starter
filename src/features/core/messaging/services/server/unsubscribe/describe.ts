// src/features/core/messaging/services/server/unsubscribe/describe.ts
//
// 確認のページ(/unsubscribe)が見せる中身: トークンを確かめ、止める種類と経路の表示名を返す(書き込みは無い)。
// 止める処理は API の POST(/api/messaging/unsubscribe)だけ

import type { MessageCategory, MessageChannel } from "@/lib/messaging";

import { categories } from "../../../extensions/categories";
import { channels } from "../../../extensions/channels";

import { verifyUnsubscribeToken } from "./token";

export type UnsubscribeTokenDescription =
  | { valid: false }
  | {
      valid: true;
      /** 止める種類の表示名(受け口に無い鍵なら鍵のまま) */
      categoryLabel: string;
      /** 止める経路の表示名(受け口に無い鍵なら鍵のまま) */
      channelLabel: string;
    };

type Lists = {
  categories: Readonly<Record<string, Pick<MessageCategory, "label">>>;
  channels: Readonly<Record<string, Pick<MessageChannel, "label">>>;
};

/** 純関数(受け口の一覧を渡す)。テストと describeUnsubscribeToken が使う */
export function describeUnsubscribeTokenWith(lists: Lists, token: string | null | undefined): UnsubscribeTokenDescription {
  const payload = verifyUnsubscribeToken(token);
  if (!payload) return { valid: false };
  return {
    valid: true,
    categoryLabel: lists.categories[payload.category]?.label ?? payload.category,
    channelLabel: lists.channels[payload.channel]?.label ?? payload.channel,
  };
}

/** トークンを確かめて止める物の表示名を返す */
export function describeUnsubscribeToken(token: string | null | undefined): UnsubscribeTokenDescription {
  return describeUnsubscribeTokenWith({ categories, channels }, token);
}
