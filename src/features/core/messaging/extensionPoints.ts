// src/features/core/messaging/extensionPoints.ts
// messaging の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 項目の型は @/lib/messaging(src/lib/messaging/receptacles/types.ts)。読み手(送る口・購読の cron)は連絡のドメインの作り直しで作る。
// 上流の項目は今 0(上流の送信チャンネル email・inApp・line も同じ受け口に入る予定)

export const extensionPoints = {
  // 送信チャンネル: channels/<名前>.ts の export const channel(鍵・表示名・宛先の決め方・欄の zod・送る関数・webhook の表)
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
  // カテゴリー(利用者から見て 1 つの出来事、D79): categories/<名前>.ts の export const category(鍵・表示名・説明・種別・送信チャンネル・グループ)。
  // fork は上流のカテゴリーの隣の <名前>.override.ts で label・description・channels・group を変えられる(鍵・種別は不可 D70 D74、
  // functional・security の email は外せない D86 = pnpm check extensions の messageGuards)
  categories: {
    dir: "categories",
    export: "category",
    type: { from: "@/lib/messaging", name: "MessageCategory" },
    side: "server",
    key: "key",
    overrideOf: ["label", "adminLabel", "description", "channels", "defaultChannels", "group"],
  },
  // カテゴリーのグループ(設定画面の見出しだけ、同じ種別のカテゴリーだけ D82): categoryGroups/<名前>.ts の export const group(鍵・表示名・並び順)。上流は出荷しない
  categoryGroups: {
    dir: "categoryGroups",
    export: "group",
    type: { from: "@/lib/messaging", name: "MessageCategoryGroup" },
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
  // 管理の一括送信の対象: bulkSendTargets/<名前>.ts の export const bulkSendTarget(鍵・表示名・選んだ記録 → 利用者 id・送った後の処理。D42)
  bulkSendTargets: {
    dir: "bulkSendTargets",
    export: "bulkSendTarget",
    type: { from: "@/features/core/messaging/services/server/admin/types", name: "MessageBulkSendTarget" },
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
  // 送信一覧の一括操作(client、D95): adminBulkActions/<名前>.tsx の export const bulkAction(上流の既定 = 削除)。
  // fork は項目を足す・<名前>.override.ts で enabled・order を変える(user の受け口と同じ形)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "@/features/core/messaging/types/adminBulkAction", name: "MessagingDispatchAdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
  // レイアウト(D122): layouts/<名前>/ のフォルダ 1 つが 1 つのレイアウト。宣言とメールの描き方は server の一覧、お知らせの描き方は client の一覧(レイアウトの鍵で引く)。
  // 描き方の部品は 1 行スイッチ(<部品>.tsx → <部品>.default.tsx)にでき、fork は .replace で見た目だけ替える。書き方: layouts/README.md
  layouts: {
    dir: "layouts",
    files: "*/layout.ts",
    export: "layout",
    type: { from: "@/lib/messaging", name: "MessageLayoutItem" },
    side: "server",
    key: "key",
  },
  layoutEmails: {
    dir: "layouts",
    files: "*/email.tsx",
    export: "emailRenderer",
    type: { from: "@/lib/messaging", name: "MessageLayoutEmailRenderer" },
    side: "server",
    key: "layout",
  },
  layoutInApps: {
    dir: "layouts",
    files: "*/inApp.tsx",
    export: "inAppRenderer",
    type: { from: "@/lib/messaging", name: "MessageLayoutInAppRenderer" },
    side: "client",
    key: "layout",
  },
};
