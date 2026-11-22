// src/domains/core/messaging/extensionPoints.ts
// messaging の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 項目の型は @/lib/messaging(src/lib/messaging/receptacles/types.ts)。読み手(送る口・購読の cron)は連絡のドメインの作り直しで作る。
// 上流の項目は今 0(上流の送信チャンネル email・inApp・line も同じ受け口に入る予定)

export const extensionPoints = {
  // 送信チャンネル: channels/<名前>.ts の export const channel(鍵・表示名・宛先の決め方・欄の zod・送る関数・webhook の表)
  messagingChannels: {
    change: "add",
    plugs: true,
    export: "channel",
    type: { from: "@/lib/messaging", name: "MessageChannel" },
    side: "server",
    key: "key",
  },
  // 値: enrichers/<名前>.ts の export const enricher(当てる連絡・足す変数の zod・値を返す関数)
  messagingEnrichers: {
    change: "add",
    plugs: true,
    export: "enricher",
    type: { from: "@/lib/messaging", name: "MessageEnricher" },
    side: "server",
    key: "key",
  },
  // カテゴリー(利用者から見て 1 つの出来事、D79): categories/<名前>.ts の export const category(鍵・表示名・説明・種別・送信チャンネル・グループ)。
  // fork は上流のカテゴリーの隣の <名前>.override.ts で label・description・channels・group を変えられる(鍵・種別は不可 D70・D166、
  // functional・security の email は外せない D86 = pnpm check extensions の messageGuards)
  messagingCategories: {
    change: "add",
    plugs: true,
    export: "category",
    type: { from: "@/lib/messaging", name: "MessageCategory" },
    side: "server",
    key: "key",
    overrideOf: ["label", "adminLabel", "description", "channels", "defaultChannels", "group"],
  },
  // カテゴリーのグループ(設定画面の見出しだけ、同じ種別のカテゴリーだけ D82): categoryGroups/<名前>.ts の export const group(鍵・表示名・並び順)。上流は出荷しない
  messagingCategoryGroups: {
    change: "add",
    plugs: true,
    export: "group",
    type: { from: "@/lib/messaging", name: "MessageCategoryGroup" },
    side: "server",
    key: "key",
  },
  // 送り元: sources/<名前>.ts の export const source(鍵・表示名)
  messagingSources: {
    change: "add",
    plugs: true,
    export: "source",
    type: { from: "@/lib/messaging", name: "MessageSource" },
    side: "server",
    key: "key",
  },
  // 記録の宛先(管理一覧で選んだ記録 → 宛先)は受け口ではない: 持ち主のドメインの plugs/recordTargets/<名前>.ts を
  // pnpm generate registry が src/registry/recordTargetRegistry.ts に集める(連絡定義と同じ道、D195。型 MessageRecordTarget は lib/messaging)
  // 送った後の購読: subscribers/<名前>.ts の export const subscriber(鍵・受ける事件・絞り・事件の束の処理)
  messagingSubscribers: {
    change: "add",
    plugs: true,
    export: "subscriber",
    type: { from: "@/lib/messaging", name: "MessageSubscriber" },
    side: "server",
    key: "key",
  },
  // レイアウト(D122): layouts/<名前>/ のフォルダ 1 つが 1 つのレイアウト。宣言とメールの描き方は server の一覧、お知らせの描き方は client の一覧(レイアウトの鍵で引く)。
  // 描き方の部品は 1 行スイッチ(<部品>.tsx → <部品>.default.tsx)にでき、fork は .replace で見た目だけ替える。
  // fork は layouts/<名前>/layout.override.ts で disabled(どこにも出さない)・adminSelectable(管理画面で選べる)だけを変える。書き方: layouts/README.md
  messagingLayouts: {
    change: "add",
    plugs: true,
    files: "*/layout.ts",
    export: "layout",
    type: { from: "@/lib/messaging", name: "MessageLayoutItem" },
    side: "server",
    key: "key",
    overrideOf: ["disabled", "adminSelectable"],
  },
  messagingLayoutEmails: {
    change: "add",
    plugs: true, itemsOf: "messagingLayouts",
    files: "*/email.tsx",
    export: "emailRenderer",
    type: { from: "@/lib/messaging", name: "MessageLayoutEmailRenderer" },
    side: "server",
    key: "layout",
  },
  messagingLayoutInApps: {
    change: "add",
    plugs: true, itemsOf: "messagingLayouts",
    files: "*/inApp.tsx",
    export: "inAppRenderer",
    type: { from: "@/lib/messaging", name: "MessageLayoutInAppRenderer" },
    side: "client",
    key: "layout",
  },
  // 差替点: 1 行スイッチ AlertEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  alertEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/alert/AlertEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/alert/AlertEmail.default", name: "AlertEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ AlertInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  alertInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/alert/AlertInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/alert/AlertInApp.default", name: "AlertInAppProps" },
    side: "client",
  },
  // 差替点: 1 行スイッチ LinkEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  linkEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/link/LinkEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/link/LinkEmail.default", name: "LinkEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ LinkInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  linkInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/link/LinkInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/link/LinkInApp.default", name: "LinkInAppProps" },
    side: "client",
  },
  // 差替点: 1 行スイッチ NoticeEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  noticeEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/notice/NoticeEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/notice/NoticeEmail.default", name: "NoticeEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ NoticeInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  noticeInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/notice/NoticeInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/notice/NoticeInApp.default", name: "NoticeInAppProps" },
    side: "client",
  },
  // 差替点: 1 行スイッチ SimpleEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  simpleEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/simple/SimpleEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/simple/SimpleEmail.default", name: "SimpleEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ SimpleInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  simpleInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/simple/SimpleInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/simple/SimpleInApp.default", name: "SimpleInAppProps" },
    side: "client",
  },
  // 差替点: 1 行スイッチ StatementEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  statementEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/statement/StatementEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/statement/StatementEmail.default", name: "StatementEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ StatementInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  statementInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/statement/StatementInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/statement/StatementInApp.default", name: "StatementInAppProps" },
    side: "client",
  },
  // 差替点: 1 行スイッチ WelcomeEmail(fork は隣に <名前>.replace を作りスイッチを向け替える)
  welcomeEmail: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/welcome/WelcomeEmail.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/welcome/WelcomeEmail.default", name: "WelcomeEmailProps" },
    side: "server",
  },
  // 差替点: 1 行スイッチ WelcomeInApp(fork は隣に <名前>.replace を作りスイッチを向け替える)
  welcomeInApp: {
    change: "replace",
    default: "src/domains/core/messaging/plugs/messagingLayouts/welcome/WelcomeInApp.default.tsx",
    type: { from: "@/domains/core/messaging/plugs/messagingLayouts/welcome/WelcomeInApp.default", name: "WelcomeInAppProps" },
    side: "client",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
