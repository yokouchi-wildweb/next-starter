// src/features/core/admin/menu/types.ts
// 管理メニューの定義の型(カテゴリー: ./categories/、項目: ./items/。一覧は ../extensions/ の生成物)と、組み立て器の入出力の型。

import type { IconComponent } from "@/components/Icons";
import type { UserRoleType } from "@/features/core/user/types";

/** 1 カテゴリーの定義(categories/<key>.ts の export const category) */
export type AdminMenuCategoryDefinition = {
  /** 一意の名前 = ファイル名(英字始まりの英数字、camelCase)。項目の category が指す */
  key: string;
  /** 見出し */
  label: string;
  /** 並び(昇順。上流のカテゴリーは 100 刻み、同じ値は key 順) */
  order: number;
  icon?: IconComponent;
  /** 見せるロール(省略 = 全員)。項目の allowRoles と AND。上流のカテゴリーは付けない */
  allowRoles?: UserRoleType[];
  /** override だけが使う: カテゴリーごと描かない */
  hidden?: boolean;
};

/** 上流のカテゴリーの隣の <key>.override.ts で変えられる属性 */
export type AdminMenuCategoryOverride = Partial<Pick<AdminMenuCategoryDefinition, "hidden" | "label" | "icon" | "allowRoles" | "order">>;

/** 展開する行の出どころ(その位置に複数行を並べる。行の中身はそれぞれの出どころで編集する) */
export type AdminMenuSourceName = "dataMenu" | "settingSections";

type AdminMenuItemBase = {
  /** 一意の名前 = ファイル名(英字始まりの英数字、camelCase)。override の対象もこの名前 */
  key: string;
  /** 置くカテゴリーの key */
  category: string;
  /** カテゴリーの中の並び(昇順、同じ値は key 順) */
  order: number;
  icon?: IconComponent;
  /** 見せるロール(省略 = 全員)。カテゴリーの allowRoles と AND */
  allowRoles?: UserRoleType[];
  /** override だけが使う: 項目を描かない */
  hidden?: boolean;
};

/** 手書きのリンク 1 行 */
export type AdminMenuLinkItem = AdminMenuItemBase & { label: string; href: string };

/** ドメインの管理一覧へのリンク 1 行(題名と href は生成の一覧 @/registry/adminDomains から。label を書けば題名だけ差し替え) */
export type AdminMenuDomainItem = AdminMenuItemBase & { domain: string; label?: string };

/** 出どころの行をその位置に展開する */
export type AdminMenuSourceItem = AdminMenuItemBase & { source: AdminMenuSourceName; label?: never };

/** 1 項目の定義(items/<key>.ts の export const item) */
export type AdminMenuItemDefinition = AdminMenuLinkItem | AdminMenuDomainItem | AdminMenuSourceItem;

/** 上流の項目の隣の <key>.override.ts で変えられる属性(allowRoles は絞るだけ: 点検が見る) */
export type AdminMenuItemOverride = Partial<Pick<AdminMenuItemBase, "hidden" | "icon" | "allowRoles" | "order" | "category">> & { label?: string };

/** 生成の管理一覧(@/registry/adminDomains)の 1 ドメイン */
export type AdminMenuDomainEntry = { label: string; href: string; addToAdminDataMenu: boolean };

/** 出どころが返す 1 行 */
export type AdminMenuRow = { label: string; href: string; icon?: IconComponent; allowRoles?: readonly string[] };

export type BuildAdminMenuInput = {
  categories: Readonly<Record<string, AdminMenuCategoryDefinition>>;
  items: Readonly<Record<string, AdminMenuItemDefinition>>;
  domains: Readonly<Record<string, AdminMenuDomainEntry>>;
  /** 出どころの行(dataMenu は dataMenuRows(domains) を渡す) */
  sources: Readonly<Record<AdminMenuSourceName, readonly AdminMenuRow[]>>;
  /** 見る人のロール(undefined = ロール指定のある物は全部見えない) */
  role: string | undefined;
  /** その住所が閉じた規則に当たるか(厳密: redirectTo 付きの閉も true)。外部 URL・枠の外の住所は呼び手が false で答える */
  isClosed: (href: string) => boolean;
};

/** 描く 1 行 */
export type AdminMenuBuiltRow = {
  /** 項目の key(展開した行は `<項目の key>#<出どころの中の番号>`) */
  key: string;
  itemKey: string;
  label: string;
  href: string;
  icon?: IconComponent;
};

/** 描く 1 カテゴリー(行が 1 つ以上) */
export type AdminMenuBuiltCategory = { key: string; label: string; icon?: IconComponent; rows: AdminMenuBuiltRow[] };

export type AdminMenuHiddenReason =
  | "category-hidden"
  | "category-role"
  | "unknown-category"
  | "item-hidden"
  | "role"
  | "closed"
  | "unknown-domain"
  | "empty-category";

/** 描かなかった物と理由(pnpm check admin-menu -- show が出す) */
export type AdminMenuHiddenEntry = { kind: "category" | "item" | "row"; key: string; reason: AdminMenuHiddenReason; href?: string };

/** 重複(止めない。pnpm check admin-menu -- show が出す) */
export type AdminMenuDuplicate = { kind: "source"; source: AdminMenuSourceName; itemKeys: string[] } | { kind: "href"; href: string; rowKeys: string[] };

export type BuiltAdminMenu = {
  categories: AdminMenuBuiltCategory[];
  hidden: AdminMenuHiddenEntry[];
  duplicates: AdminMenuDuplicate[];
};
