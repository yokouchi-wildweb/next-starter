// src/app/(user)/_layout/config.ts — ユーザー側の枠(ヘッダー・下部メニュー・フッター・枠全体)の値の設定(既定 + 上書き)。設定の議会 D98
// 上書きは src/config/layout/user.config.ts(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig
// アイコン・部品を持つ値(メニュー項目・SNS リンク・ログアウトのアイコン)は ./config.ui.ts(同じ段の鍵)。
// ヘッダー・ナビ・フッターを出す・隠す(端末ごと・ページごと)は各ルートの枠の宣言 frame.ts / frame.override.ts(src/app/_layout/frame/README.md)。
// 部品の差し替えは config ではなく UserLayout の slot で行う(./README.md)

import type { MainProps } from "@/components/Layout/Main";
import override, { type Extra } from "@/config/layout/user.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

/** 枠の名前(地区の地図が字面で読む。上書きは src/config/layout/<この名前>.config.ts) */
export const userLayoutFrame = { frame: "user" } as const;

/** フッターリンクの項目 */
export type FooterLinkItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
};

export type UserLayoutConfig = {
  header: {
    /** ロゴクリック時の遷移先 */
    logoLink: string;
    /** メニューにアイコンを表示するか */
    menuIconsEnabled: boolean;
    logout: {
      /** ログアウトボタンを表示するか(認証済みユーザーのみ対象) */
      show: boolean;
      /** ログアウトボタンのラベル */
      label: string;
      /** ログアウト後のリダイレクト先 */
      redirectTo: string;
    };
  };
  bottomMenu: {
    /** ボトムナビの高さ(px) */
    height: number;
    /** カレントアイテムの色(primary / secondary / accent) */
    activeColorType: "primary" | "secondary" | "accent";
  };
  footer: {
    /** フッター自体を表示するか */
    enabled: boolean;
    /** フッターの表示設定(sp = 640px 未満、pc = 640px 以上) */
    visibility: { sp: boolean; pc: boolean };
    sns: {
      /** SNS リンクを表示するか(リンクの一覧は config.ui.ts の footer.sns.links) */
      enabled: boolean;
    };
    /** フッターリンクを表示するか */
    linksEnabled: boolean;
    /** フッターリンク一覧 */
    links: FooterLinkItem[];
    /** フッターリンクのセパレーター */
    linkSeparator: string;
    copyright: {
      /** コピーライトを表示するか */
      enabled: boolean;
      /** 年の表記(自由形式)。例: "2025", "2020-2025", "2020年〜", ""(空で年なし) */
      year: string;
      /**
       * コピーライトのフォーマット
       * - "simple": © {year} {serviceName}
       * - "allRights": © {year} {serviceName}. All rights reserved.
       * - "full": Copyright © {year} {serviceName}
       * - "custom": customText を使用
       */
      format: "simple" | "allRights" | "full" | "custom";
      /** カスタムフォーマット時の文字列({year} と {serviceName} が置換される) */
      customText: string;
    };
  };
  layout: {
    background: {
      /** 背景画像の URL(例: imgPath("backgrounds/user-bg.jpg") の結果の文字列)。空文字 = 画像なし(bg-background の単色) */
      imageUrl: string;
      /** オーバーレイの色(任意の CSS 色形式: "#000", "black", "rgb(0,0,0)" など) */
      overlayColor: string;
      /** オーバーレイの透明度(0-1) */
      overlayOpacity: number;
    };
    /**
     * UserPage の containerType の既定(ページが containerType を渡せばそちらが勝つ。fill のページは "plain" を渡す)。
     * 値は Layout/Main の containerType。アプリ全体で 1 つ(layout ごとの既定は持たない)
     */
    pageContainerType: NonNullable<MainProps["containerType"]>;
  };
};

const defaults: UserLayoutConfig = {
  header: {
    logoLink: "/",
    menuIconsEnabled: false,
    logout: {
      show: true,
      label: "ログアウト",
      redirectTo: "/login",
    },
  },
  bottomMenu: {
    height: 64,
    activeColorType: "accent",
  },
  footer: {
    enabled: true,
    visibility: { sp: true, pc: true },
    sns: { enabled: true },
    linksEnabled: true,
    links: [
      { key: "terms", label: "利用規約", href: "/terms" },
      { key: "privacy", label: "プライバシーポリシー", href: "/privacy-policy" },
      { key: "commerce", label: "特商法表記", href: "/tradelaw" },
    ],
    linkSeparator: "|",
    copyright: {
      enabled: true,
      year: "2025",
      format: "simple",
      customText: "© {year} {serviceName}",
    },
  },
  layout: {
    background: {
      imageUrl: "",
      overlayColor: "#000",
      overlayOpacity: 0,
    },
    pageContainerType: "contentShell",
  },
};

export const userLayoutConfigDef = defineConfig(defaults, { label: "user" });

/** 上書きのファイルの型(`export default { ... } satisfies UserLayoutOverride`) */
export type UserLayoutOverride<E extends object = Record<never, never>> = OverrideOf<typeof userLayoutConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る。fork 独自の鍵は上書きの Extra の型で足される) */
export const userLayoutConfig = userLayoutConfigDef.compose<Extra>(override);
