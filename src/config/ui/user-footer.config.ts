/**
 * ユーザー向けフッターの設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 */

import type { IconType } from "react-icons";
import { FaFacebook, FaInstagram, FaTiktok, FaXTwitter } from "react-icons/fa6";

// ============================================
// コンポーネント設定
// ============================================

/**
 * フッターコンポーネント
 * カスタム版を使用する場合は以下のようにコメントを切り替えてください：
 *
 * export { UserFooter } from "@/components/AppFrames/User/Sections/FooterCustom";
 */
export { UserFooter } from "@/components/AppFrames/User/Sections/Footer";

// ============================================
// 基本設定
// ============================================

/** フッター自体を表示するか */
export const FOOTER_ENABLED = true;

/** フッターの表示設定 */
export const FOOTER_VISIBILITY = {
  /** スマホ版（640px未満）で表示するか */
  sp: true,
  /** PC版（640px以上）で表示するか */
  pc: true,
} as const;

// ============================================
// SNSリンク設定
// ============================================

/** SNSリンクを表示するか */
export const SNS_ENABLED = true;

/** SNSリンクアイテムの型 */
export type SocialLinkItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon: IconType;
};

/** SNSリンク一覧 */
export const SOCIAL_LINKS: SocialLinkItem[] = [
  {
    key: "x",
    label: "X",
    href: "https://x.com/",
    icon: FaXTwitter,
  },
  {
    key: "instagram",
    label: "Instagram",
    href: "https://instagram.com/",
    icon: FaInstagram,
  },
  {
    key: "facebook",
    label: "Facebook",
    href: "https://facebook.com/",
    icon: FaFacebook,
  },
  {
    key: "tiktok",
    label: "TikTok",
    href: "https://tiktok.com/",
    icon: FaTiktok,
  },
];

// ============================================
// フッターリンク設定
// ============================================

/** フッターリンクを表示するか */
export const FOOTER_LINKS_ENABLED = true;

/** フッターリンクアイテムの型 */
export type FooterLinkItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
};

/** フッターリンク一覧 */
export const FOOTER_LINKS: FooterLinkItem[] = [
  { key: "terms", label: "利用規約", href: "/terms" },
  { key: "privacy", label: "プライバシーポリシー", href: "/privacy-policy" },
  { key: "commerce", label: "特商法表記", href: "/tradelaw" },
];

/** フッターリンクのセパレーター */
export const FOOTER_LINK_SEPARATOR = "|";

// ============================================
// コピーライト設定
// ============================================

/** コピーライトを表示するか */
export const COPYRIGHT_ENABLED = true;

/**
 * 年の表記（自由形式）
 * 例: "2025", "2020-2025", "2020年〜", ""（空で年なし）
 */
export const COPYRIGHT_YEAR = "2025";

/**
 * コピーライトのフォーマット
 * - "simple": © {year} {serviceName}
 * - "allRights": © {year} {serviceName}. All rights reserved.
 * - "full": Copyright © {year} {serviceName}
 * - "custom": カスタム文字列を使用
 */
export const COPYRIGHT_FORMAT: "simple" | "allRights" | "full" | "custom" =
  "simple";

/**
 * カスタムフォーマット時の文字列
 * {year} と {serviceName} が置換されます
 */
export const COPYRIGHT_CUSTOM_TEXT = "© {year} {serviceName}";
