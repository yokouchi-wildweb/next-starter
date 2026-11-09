// src/app/(user)/_layout/config.ui.ts — ユーザー側の枠の描画専用の設定(既定 + 上書き)。設定の議会 D38・D98
// 上書きは src/config/layout/user.ui.config.ts(このファイルだけが読む)。値の設定は ./config.ts、アイコン・部品を持つ値はここ(同じ段の鍵)。
// 項目の型もここに置く(枠の部品 Header・BottomNav・Footer が読む)。置き方: src/config/README.md

import type { ComponentType, ReactNode } from "react";

import { Dices, History, Home, LayoutGrid, LogIn, LogOut, Package, User, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import { FaFacebook, FaInstagram, FaTiktok, FaXTwitter } from "react-icons/fa6";

import type { IconComponent } from "@/components/Icons";
import override, { type Extra } from "@/config/layout/user.ui.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 上書きの中で読んでよい指定子(アイコンの部品) */
export const overrideImports = ["lucide-react", "react-icons", "@/components/Icons"] as const;

// ============================================
// ヘッダー
// ============================================

/** ヘッダーのメニュー項目 */
export type HeaderMenuItem = {
  readonly key: string;
  readonly label: string;
  /** なし = クリックでリンク遷移しない(ドロップダウンのみ) */
  readonly href?: string;
  readonly icon?: IconComponent;
  readonly children?: HeaderMenuItem[];
};

// ============================================
// 下部メニュー(ボトムナビ)
// ============================================

/**
 * リンク項目(type 省略 = "link")
 *
 * @example
 * { key: "home", label: "ホーム", href: "/", icon: Home, matchPaths: ["/", "/home"] }
 */
export type BottomNavLinkItem = {
  readonly type?: "link";
  /** 一意のキー */
  readonly key: string;
  /** 表示ラベル */
  readonly label: string;
  /** リンク先パス */
  readonly href: string;
  /** Lucide-reactアイコンコンポーネント */
  readonly icon: ComponentType<{ className?: string }>;
  /**
   * カレント判定用のパス配列(オプション)
   * 指定しない場合は href と完全一致で判定
   * 指定した場合は matchPaths のいずれかに前方一致で判定
   */
  readonly matchPaths?: readonly string[];
  /** アイコン右上に表示するバッジ(未読数やドットなど) */
  readonly badge?: ReactNode;
};

/** メニュー項目から開くアクション(遷移のみ) */
export type BottomNavMenuAction = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon?: LucideIcon;
};

/**
 * メニュー項目(タップで上向きのアクションメニューを開く。例: 「＋」)。カレントにはならない
 *
 * @example
 * { type: "menu", key: "create", label: "作成", icon: Plus, menu: [{ key: "post", label: "投稿", href: "/posts/new" }] }
 */
export type BottomNavMenuItem = {
  readonly type: "menu";
  readonly key: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  /** メニューのタイトル(省略 = label) */
  readonly menuTitle?: string;
  readonly menu: readonly BottomNavMenuAction[];
  /** アイコン右上に表示するバッジ */
  readonly badge?: ReactNode;
};

/** ボトムナビゲーションのアイテム定義 */
export type BottomNavItem = BottomNavLinkItem | BottomNavMenuItem;

// ============================================
// フッター
// ============================================

/** SNS リンクの項目 */
export type SocialLinkItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon: IconType;
};

export type UserLayoutUiConfig = {
  header: {
    /** 認証済みユーザー用メニュー(ログアウト以外) */
    authenticatedMenuItems: HeaderMenuItem[];
    /** 未認証ユーザー用メニュー */
    guestMenuItems: HeaderMenuItem[];
    logout: {
      /** ログアウトボタンのアイコン */
      icon: IconComponent;
    };
  };
  bottomMenu: {
    /** 認証済みユーザー用メニュー */
    authenticatedMenuItems: BottomNavItem[];
    /** 未認証ユーザー用メニュー */
    guestMenuItems: BottomNavItem[];
  };
  footer: {
    sns: {
      /** SNS リンク一覧(表示するかは config.ts の footer.sns.enabled) */
      links: SocialLinkItem[];
    };
  };
};

const defaults: UserLayoutUiConfig = {
  header: {
    authenticatedMenuItems: [
      { key: "home", label: "ホーム", href: "/", icon: Home },
      {
        key: "service",
        label: "サービス",
        icon: LayoutGrid,
        // href なし: クリックでリンク遷移しない(ドロップダウンのみ)
        children: [
          { key: "service-a", label: "サービスA", href: "/services/a" },
          { key: "service-b", label: "サービスB", href: "/services/b" },
        ],
      },
      { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
    ],
    guestMenuItems: [
      { key: "home", label: "ホーム", href: "/", icon: Home },
      {
        key: "service",
        label: "サービス",
        href: "/services", // href あり: クリックでリンク遷移も可能
        icon: LayoutGrid,
        children: [
          { key: "service-a", label: "サービスA", href: "/services/a" },
          { key: "service-b", label: "サービスB", href: "/services/b" },
        ],
      },
      { key: "login", label: "ログイン", href: "/login", icon: LogIn },
      { key: "signup", label: "会員登録", href: "/signup", icon: UserPlus },
    ],
    logout: { icon: LogOut },
  },
  bottomMenu: {
    authenticatedMenuItems: [
      { key: "game", label: "ゲームプレイ", href: "/game", icon: Dices },
      { key: "items", label: "獲得商品", href: "/items", icon: Package },
      { key: "history", label: "購入履歴", href: "/history", icon: History },
      { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
    ],
    guestMenuItems: [
      { key: "game", label: "ゲームプレイ", href: "/game", icon: Dices },
      { key: "login", label: "ログイン", href: "/login", icon: LogIn },
    ],
  },
  footer: {
    sns: {
      links: [
        { key: "x", label: "X", href: "https://x.com/", icon: FaXTwitter },
        { key: "instagram", label: "Instagram", href: "https://instagram.com/", icon: FaInstagram },
        { key: "facebook", label: "Facebook", href: "https://facebook.com/", icon: FaFacebook },
        { key: "tiktok", label: "TikTok", href: "https://tiktok.com/", icon: FaTiktok },
      ],
    },
  },
};

export const userLayoutUiConfigDef = defineConfig<UserLayoutUiConfig>(defaults, { label: "user.ui" });

/** 上書きのファイルの型(`export default { ... } satisfies UserLayoutUiOverride`) */
export type UserLayoutUiOverride<E extends object = Record<never, never>> = OverrideOf<typeof userLayoutUiConfigDef, E>;

/** 合成済みの描画用の設定(fork 独自の鍵は上書きの Extra の型で足される) */
export const userLayoutUiConfig = userLayoutUiConfigDef.compose<Extra>(override);
