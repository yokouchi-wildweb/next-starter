// src/features/core/messaging/channels/inApp/createInAppChannel.ts
//
// お知らせ(受け取り箱)の送信チャンネルの項目を部品から作る(本物の部品は index.ts、テストは偽物を渡す)。
// - 宛先: 利用者の id そのもの(帳簿は要らない)
// - 送信 = message_inbox_items に受信者ごとの行を書く(選んだ宛先の送信と、中身が受信者に依る送信)。
//   全員・ロール宛てで中身が受信者に依らない送信は、展開の時に送信に 1 行の共有の行を書き、この項目は呼ばれない(D32)
// - 送信の id は配達の行(冪等の鍵 = 配達の id)から引く。同じ送信 × 利用者の行が既にあれば書かない(送り直しで重ねない)
// - 画像(storage:// の参照)は書く前に送信へ結び(bindImages、services/server/inbox/imageBinding.ts)、結んだ参照を行に書く。
//   台帳の持ち主は送信(宛先ごとの行は同じ 1 つのファイルを指す)
// - 取り下げ(remove): 管理の削除が呼ぶ。送信の行を全部消し、画像を台帳から外す(何度呼んでも同じ)
// - throttle のある連絡の行は、この send ではなく間引きの処理(services/server/sendMessage/throttle.ts)が inAppItemRow の形で書く
// - 中身(指令 60、D121): 送る口は描かずに MessageLayoutContent(題・レイアウト・段・お知らせの送信チャンネルの欄の中身・要約)を渡す(rendersAtSend)。
//   行 = 要約の列(title = 題、body = 短い本文 ?? 本文、image、link = 行き先の URL)+ レイアウトの鍵・版・欄の中身(詳細がレイアウトの描き方で描く)。
//   行は届けた中身で記録ではないので、記録の段・required に依らず欄の中身を残す(D120)。秘密の欄は呼び手が空の字で差し込む(D130)。
//   前の形の中身(MessageLayoutContent でない)だけ layout・values が null = 要約のカード

import { isMessageLayoutContent, type ChannelSendResult, type MessageChannel } from "@/lib/messaging";

import type { MessageInboxItemInsert } from "../../entities/model";
import { inboxItemImageRefs, withBoundInboxImages } from "../../services/server/inbox/imageBinding";

export type InAppChannelDeps = {
  /** 配達の id → 送信の id */
  findDispatchIds: (deliveryIds: readonly string[]) => Promise<Map<string, string>>;
  /** 既にある (送信, 利用者) の組("<dispatchId>|<userId>") */
  findExistingItems: (pairs: readonly { dispatchId: string; userId: string }[]) => Promise<Set<string>>;
  insertItems: (rows: readonly MessageInboxItemInsert[]) => Promise<void>;
  /** 送信に画像を結ぶ(元の参照 → 行に書く参照)。送信ごとに 1 回呼ぶ */
  bindImages: (dispatchId: string, refs: readonly string[]) => Promise<Map<string, string>>;
  /** 送信のお知らせの行(共有の行・受信者ごとの行)を消し、送信に結んだ画像を外す(管理の削除、D89)。消した行の数 */
  removeDispatch: (dispatchId: string) => Promise<number>;
  now: () => Date;
};

/** 送る口が中身に足すレイアウトの版(services/server/sendMessage/content.ts) */
type InAppLayoutContent = { layoutVersion?: unknown };

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * 描いた中身から受信者ごとのお知らせの行を作る(この送信チャンネルの send と、間引きの処理が鍵の lock の取引の中で書く行の共通の形)。
 * 中身は MessageLayoutContent(前の形 { title, body, image?, link? } も読む)。image は結ぶ前の参照(呼び手が bindImages で結んだ参照に替える)
 */
export function inAppItemRow(
  content: Readonly<Record<string, unknown>>,
  params: { dispatchId: string; userId: string | null; now: Date },
): MessageInboxItemInsert {
  return { ...inboxColumnsOf(content), dispatch_id: params.dispatchId, user_id: params.userId, published_at: params.now };
}

/** 中身 → 行の要約の列とレイアウトの列 */
export function inboxColumnsOf(
  content: Readonly<Record<string, unknown>>,
): Pick<MessageInboxItemInsert, "title" | "body" | "link" | "image" | "layout" | "layout_version" | "values"> {
  if (isMessageLayoutContent(content)) {
    const { summary } = content;
    const values = content.values && typeof content.values === "object" ? (content.values as Record<string, unknown>) : null;
    const version = (content as InAppLayoutContent).layoutVersion;
    return {
      title: summary.title,
      body: summary.shortBody ?? summary.body,
      link: summary.link?.url ?? null,
      image: summary.image ?? null,
      layout: values ? content.layout : null,
      layout_version: values && typeof version === "number" ? version : null,
      values,
    };
  }
  return {
    title: str(content.title),
    body: str(content.body) ?? "",
    link: str(content.link),
    image: str(content.image),
    layout: null,
    layout_version: null,
    values: null,
  };
}

export function createInAppChannel(deps: InAppChannelDeps): MessageChannel {
  return {
    key: "inApp",
    label: "サービス内通知",
    addressing: "user",
    remove: async ({ dispatchId }) => ({ removed: await deps.removeDispatch(dispatchId) }),
    // レイアウトの描き方(D124): お知らせの行は要約の列 + レイアウトと欄の中身。レイアウトの inApp の描き方は client の一覧(画面が詳細で描く)。
    // 送る時に行を書く(rendersAtSend)ので中身は MessageLayoutContent。要約からの描き方は段の宣言(描けるか)とプレビューに使う
    rendersAtSend: true,
    summaryRenderable: true,
    renderFromSummary: (summary) => ({
      content: {
        title: summary.title,
        body: summary.body,
        ...(summary.image ? { image: summary.image } : {}),
        ...(summary.link ? { link: summary.link.url } : {}),
      },
    }),
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
          rows.push(inAppItemRow(target.content, { dispatchId, userId, now }));
          existing.add(pair);
        }
        results.push({ address: target.address, kind: "sent", provider: "inApp", providerMessageId: null });
      }
      if (rows.length > 0) {
        const imagesByDispatch = new Map<string, Set<string>>();
        for (const row of rows) {
          const refs = inboxItemImageRefs(row);
          if (refs.length === 0) continue;
          const set = imagesByDispatch.get(row.dispatch_id) ?? new Set<string>();
          for (const ref of refs) set.add(ref);
          imagesByDispatch.set(row.dispatch_id, set);
        }
        const bound = new Map<string, Map<string, string>>();
        for (const [dispatchId, refs] of imagesByDispatch) bound.set(dispatchId, await deps.bindImages(dispatchId, [...refs]));
        const written = rows.map((row) => {
          const map = bound.get(row.dispatch_id);
          return map ? withBoundInboxImages(row, map) : row;
        });
        await deps.insertItems(written);
      }
      return results;
    },
  };
}
