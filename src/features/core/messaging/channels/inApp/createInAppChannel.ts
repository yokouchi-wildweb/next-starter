// src/features/core/messaging/channels/inApp/createInAppChannel.ts
//
// お知らせ(受け取り箱)の経路の項目を部品から作る(本物の部品は index.ts、テストは偽物を渡す)。
// - 宛先: 利用者の id そのもの(帳簿は要らない)
// - 送信 = message_inbox_items に受信者ごとの行を書く(選んだ宛先の送信と、中身が受信者に依る送信)。
//   全員・ロール宛てで中身が受信者に依らない送信は、展開の時に回に 1 行の共有の行を書き、この項目は呼ばれない(D32)
// - 回の id は配達の行(冪等の鍵 = 配達の id)から引く。同じ回 × 利用者の行が既にあれば書かない(送り直しで重ねない)
// - 画像(storage:// の参照)は書く前に回へ結び(bindImages、services/server/inbox/imageBinding.ts)、結んだ参照を行に書く。
//   台帳の持ち主は回(宛先ごとの行は同じ 1 つのファイルを指す)

import { inAppFieldsSchema, type ChannelSendResult, type MessageChannel } from "@/lib/messaging";

import type { MessageInboxItemInsert } from "../../entities/model";

export type InAppChannelDeps = {
  /** 配達の id → 回の id */
  findDispatchIds: (deliveryIds: readonly string[]) => Promise<Map<string, string>>;
  /** 既にある (回, 利用者) の組("<dispatchId>|<userId>") */
  findExistingItems: (pairs: readonly { dispatchId: string; userId: string }[]) => Promise<Set<string>>;
  insertItems: (rows: readonly MessageInboxItemInsert[]) => Promise<void>;
  /** 回に画像を結ぶ(元の参照 → 行に書く参照)。回ごとに 1 回呼ぶ */
  bindImages: (dispatchId: string, refs: readonly string[]) => Promise<Map<string, string>>;
  now: () => Date;
};

type InAppContent = { title?: string; body?: string; image?: string; link?: string };

export function createInAppChannel(deps: InAppChannelDeps): MessageChannel {
  return {
    key: "inApp",
    label: "お知らせ",
    addressing: "user",
    fields: inAppFieldsSchema,
    resolveAddresses: async (userIds) => userIds.map((userId) => ({ userId, address: userId })),
    async send(targets) {
      const deliveryIdOf = (key: string) => key.split(":")[0];
      const dispatchIds = await deps.findDispatchIds([...new Set(targets.map((t) => deliveryIdOf(t.idempotencyKey)))]);
      const pairs = targets.flatMap((target) => {
        const dispatchId = dispatchIds.get(deliveryIdOf(target.idempotencyKey));
        const userId = target.userId ?? target.address;
        return dispatchId ? [{ dispatchId, userId }] : [];
      });
      const existing = await deps.findExistingItems(pairs);
      const rows: MessageInboxItemInsert[] = [];
      const results: ChannelSendResult[] = [];
      const now = deps.now();
      for (const target of targets) {
        const dispatchId = dispatchIds.get(deliveryIdOf(target.idempotencyKey));
        const userId = target.userId ?? target.address;
        if (!dispatchId) {
          results.push({ address: target.address, kind: "permanent", reason: "delivery_missing" });
          continue;
        }
        const pair = `${dispatchId}|${userId}`;
        if (!existing.has(pair)) {
          const content = target.content as InAppContent;
          rows.push({
            dispatch_id: dispatchId,
            user_id: userId,
            title: content.title ?? null,
            body: content.body ?? "",
            link: content.link ?? null,
            image: content.image ?? null,
            published_at: now,
          });
          existing.add(pair);
        }
        results.push({ address: target.address, kind: "sent", provider: "inApp", providerMessageId: null });
      }
      if (rows.length > 0) {
        const imagesByDispatch = new Map<string, Set<string>>();
        for (const row of rows) {
          if (!row.image) continue;
          const set = imagesByDispatch.get(row.dispatch_id) ?? new Set<string>();
          set.add(row.image);
          imagesByDispatch.set(row.dispatch_id, set);
        }
        for (const [dispatchId, refs] of imagesByDispatch) {
          const bound = await deps.bindImages(dispatchId, [...refs]);
          for (const row of rows) {
            if (row.dispatch_id === dispatchId && row.image) row.image = bound.get(row.image) ?? row.image;
          }
        }
        await deps.insertItems(rows);
      }
      return results;
    },
  };
}
