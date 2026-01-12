// src/config/ui/admin-insane-menu.config.ts

/**
 * インセインモード用メニュー設定
 * 特権的な管理機能をまとめた裏メニュー
 */
export const insaneMenu = [
  {
    title: "インセインモード",
    href: "/admin/insane",
    items: [
      { title: "ダッシュボード", href: "/admin/insane" },
      { title: "通常管理画面へ戻る", href: "/admin" },
    ],
  },
  // TODO: 特権メニュー項目を追加
];
