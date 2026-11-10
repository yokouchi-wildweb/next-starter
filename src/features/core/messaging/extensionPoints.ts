// src/features/core/messaging/extensionPoints.ts
// messaging の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 項目の型は @/lib/messaging(src/lib/messaging/receptacles/types.ts)。読み手(送る口・購読の cron)は連絡のドメインの作り直しで作る。
// 上流の項目は今 0(上流の経路 email・inApp・line も同じ受け口に入る予定)

export const extensionPoints = {
  // 経路: channels/<名前>.ts の export const channel(鍵・表示名・宛先の決め方・欄の zod・送る関数・webhook の表)
  channels: {
    dir: "channels",
    export: "channel",
    type: { from: "@/lib/messaging", name: "MessageChannel" },
    side: "server",
    key: "key",
  },
  // 値: enrichers/<名前>.ts の export const enricher(当てる連絡・足す変数の zod・値を返す関数)
  enrichers: {
    dir: "enrichers",
    export: "enricher",
    type: { from: "@/lib/messaging", name: "MessageEnricher" },
    side: "server",
    key: "key",
  },
  // 配信停止の種類: categories/<名前>.ts の export const category(鍵・表示名・説明・基の種別)
  categories: {
    dir: "categories",
    export: "category",
    type: { from: "@/lib/messaging", name: "MessageCategory" },
    side: "server",
    key: "key",
  },
  // 宛先の集め方(管理の送信): audiences/<名前>.ts の export const audience(鍵・表示名・引数の zod・keyset で利用者 id)
  audiences: {
    dir: "audiences",
    export: "audience",
    type: { from: "@/lib/messaging", name: "MessageAudience" },
    side: "server",
    key: "key",
  },
  // 送り元: sources/<名前>.ts の export const source(鍵・表示名)
  sources: {
    dir: "sources",
    export: "source",
    type: { from: "@/lib/messaging", name: "MessageSource" },
    side: "server",
    key: "key",
  },
  // 送った後の購読: subscribers/<名前>.ts の export const subscriber(鍵・受ける事件・絞り・事件の束の処理)
  subscribers: {
    dir: "subscribers",
    export: "subscriber",
    type: { from: "@/lib/messaging", name: "MessageSubscriber" },
    side: "server",
    key: "key",
  },
};
