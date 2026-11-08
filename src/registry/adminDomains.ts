// 生成物・編集不可: pnpm generate registry が src/features/**/domain.json と src/app/admin/(protected)/<kebab 複数形>/page.tsx から生成する
// src/registry/adminDomains.ts
//
// 管理一覧の画面を持つドメインの一覧(キー = フォルダ名)。管理メニューの項目 domain:"<名前>" が題名と住所を引き、
// 出どころ dataMenu が addToAdminDataMenu: true の行を展開する(src/features/core/admin/menu/)。

export const adminDomains = {
  chatRoom: { label: "チャットルーム", href: "/admin/chat-rooms", addToAdminDataMenu: false },
  notification: { label: "お知らせ", href: "/admin/notifications", addToAdminDataMenu: false },
  notificationTemplate: { label: "お知らせテンプレート", href: "/admin/notification-templates", addToAdminDataMenu: false },
  userTag: { label: "ユーザータグ", href: "/admin/user-tags", addToAdminDataMenu: false },
  sample: { label: "サンプル", href: "/admin/samples", addToAdminDataMenu: true },
  sampleCategory: { label: "サンプルカテゴリ", href: "/admin/sample-categories", addToAdminDataMenu: true },
  sampleTag: { label: "サンプルタグ", href: "/admin/sample-tags", addToAdminDataMenu: true },
} as const satisfies Record<string, { label: string; href: string; addToAdminDataMenu: boolean }>;

export type AdminDomainName = keyof typeof adminDomains;
