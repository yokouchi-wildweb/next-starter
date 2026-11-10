// src/features/core/user/types/mypageMenu.ts
// マイページのメニューの項目の型(受け口 mypageMenu: src/features/core/user/mypageMenu/items/<key>.ts の export const item)と、
// 組み立て器(mypageMenu/buildMypageMenu.ts)の入出力の型。書き方: src/features/core/user/README.md「マイページのメニュー」

import type { LucideIcon } from "lucide-react";

/** 項目が名指せる操作(画面の側でフックに結ぶ)。今は logout だけ */
export type MypageMenuAction = "logout";

/** カードの見た目(RichMenuCard の variant と同じ) */
export type MypageMenuVariant = "default" | "muted" | "destructive";

type MypageMenuItemBase = {
  /** 一意の名前 = ファイル名(英字始まりの英数字、camelCase)。override の対象もこの名前 */
  key: string;
  /** 並び(昇順。上流の項目は 10 刻み、同じ値は key 順) */
  order: number;
  title: string;
  description: string;
  icon: LucideIcon;
  variant?: MypageMenuVariant;
  /** override だけが使う: 項目を描かない */
  hidden?: boolean;
};

/** リンクの項目(閉じた機能の住所は棚の Link が描かない) */
export type MypageMenuLinkItem = MypageMenuItemBase & {
  href: string;
  showChevron?: boolean;
  action?: never;
  /**
   * リンクでは使わない(受けて無視する)。上書きの型 MypageMenuItemOverride は全部の項目に共通で、
   * 生成の一覧が { ...項目, ...上書き } と重ねても型が通るように受ける
   */
  pendingTitle?: string;
};

/** 操作の項目(押すと action に結んだ処理が走る) */
export type MypageMenuActionItem = MypageMenuItemBase & {
  action: MypageMenuAction;
  /** 処理中の題名(省略 = title のまま) */
  pendingTitle?: string;
  href?: never;
  showChevron?: never;
};

/** 1 項目の定義(mypageMenu/items/<key>.ts の export const item) */
export type MypageMenuItem = MypageMenuLinkItem | MypageMenuActionItem;

/** 上流の項目の隣の <key>.override.ts で変えられる属性(受け口の overrideOf と同じ) */
export type MypageMenuItemOverride = Partial<
  Pick<MypageMenuItemBase, "hidden" | "order" | "title" | "description" | "icon" | "variant"> & { pendingTitle: string }
>;

/** 操作の結び先(画面がフックから渡す) */
export type MypageMenuActionBinding = { run: () => void | Promise<void>; pending: boolean };

type MypageMenuBuiltRowBase = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  variant?: MypageMenuVariant;
};

/** 描く 1 行: リンク */
export type MypageMenuBuiltLinkRow = MypageMenuBuiltRowBase & { kind: "link"; href: string; showChevron?: boolean };

/** 描く 1 行: 操作 */
export type MypageMenuBuiltActionRow = MypageMenuBuiltRowBase & {
  kind: "action";
  action: MypageMenuAction;
  onClick: () => void;
  disabled: boolean;
};

export type MypageMenuBuiltRow = MypageMenuBuiltLinkRow | MypageMenuBuiltActionRow;

export type MypageMenuHiddenEntry = { key: string; reason: "item-hidden" | "unknown-action" };

export type BuildMypageMenuInput = {
  items: Readonly<Record<string, MypageMenuItem>>;
  /** 結んでいない操作の項目は描かない(hidden に unknown-action) */
  actions: Readonly<Partial<Record<MypageMenuAction, MypageMenuActionBinding>>>;
};

export type BuiltMypageMenu = { rows: MypageMenuBuiltRow[]; hidden: MypageMenuHiddenEntry[] };
