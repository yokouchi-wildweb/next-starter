// 生成物・編集不可: pnpm registry:generate が src/features/**/domain.json の addToAdminDataMenu から生成する
// src/registry/adminDataMenu.ts
//
// 管理画面「データ管理」のメニュー。ドメインを載せる = domain.json の addToAdminDataMenu: true。
// それ以外の行(adminRoutes の無いドメインへの手書きのリンクなど)は src/config/ui/admin-global-menu.config.ts に書く。

export const adminDataMenu: { title: string; href: string }[] = [
  { title: "サンプル", href: "/admin/samples" },
  { title: "サンプルカテゴリ", href: "/admin/sample-categories" },
  { title: "サンプルタグ", href: "/admin/sample-tags" },
];
