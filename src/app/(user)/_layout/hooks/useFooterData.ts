/**
 * カスタムフッター用のデータを提供するフック
 *
 * 設定: 枠の設定 ../config.ts の footer(値)と ../config.ui.ts の footer.sns.links(SNS リンク)
 */

"use client";

import { useMemo } from "react";

import { business } from "@/business";
import { type FooterLinkItem, userLayoutConfig } from "../config";
import { type SocialLinkItem, userLayoutUiConfig } from "../config.ui";

// ============================================
// 型定義
// ============================================

/** SP/PC表示設定 */
export type DeviceVisibility = {
  readonly sp: boolean;
  readonly pc: boolean;
};

/** useFooterData の戻り値 */
export type UseFooterDataReturn = {
  /** フッター機能が有効か */
  enabled: boolean;
  /** フッターの表示設定（SP/PC、枠の設定の footer.visibility。ページ単位で隠すのは Hide* の印の CSS） */
  visibility: DeviceVisibility;
  /** SNSリンクが有効か */
  snsEnabled: boolean;
  /** SNSリンク一覧 */
  socialLinks: readonly SocialLinkItem[];
  /** フッターリンクが有効か */
  linksEnabled: boolean;
  /** フッターリンク一覧 */
  footerLinks: readonly FooterLinkItem[];
  /** フッターリンクのセパレーター */
  linkSeparator: string;
  /** コピーライトが有効か */
  copyrightEnabled: boolean;
  /** 生成済みコピーライトテキスト */
  copyrightText: string;
  /** footer.visibility から作る SP/PC の表示クラス */
  visibilityClass: string;
};

// ============================================
// ユーティリティ
// ============================================

/**
 * コピーライトテキストを生成
 */
function getCopyrightText(): string {
  const { year, format, customText } = userLayoutConfig.footer.copyright;
  const serviceName = business.serviceName;

  switch (format) {
    case "simple":
      return year ? `© ${year} ${serviceName}` : `© ${serviceName}`;
    case "allRights":
      return year
        ? `© ${year} ${serviceName}. All rights reserved.`
        : `© ${serviceName}. All rights reserved.`;
    case "full":
      return year
        ? `Copyright © ${year} ${serviceName}`
        : `Copyright © ${serviceName}`;
    case "custom":
      return customText.replace("{year}", year).replace(
        "{serviceName}",
        serviceName
      );
    default:
      return `© ${year} ${serviceName}`;
  }
}

/**
 * footer.visibility から作る表示クラス(描画時に呼ぶ)。
 */
const getFooterVisibilityClass = ({ sp, pc }: DeviceVisibility): string => {
  if (!sp && !pc) return "hidden";
  if (!sp && pc) return "hidden sm:flex";
  if (sp && !pc) return "flex sm:hidden";
  return "flex";
};

// ============================================
// フック実装
// ============================================

export const useFooterData = (): UseFooterDataReturn => {
  // 基本の表示は config の値(固定の class)。ページ単位で隠すのは Hide* の印の CSS
  const visibility: DeviceVisibility = userLayoutConfig.footer.visibility;
  const visibilityClass = getFooterVisibilityClass(visibility);

  // コピーライトテキスト（メモ化）
  const copyrightText = useMemo(() => getCopyrightText(), []);

  return {
    enabled: userLayoutConfig.footer.enabled,
    visibility,
    snsEnabled: userLayoutConfig.footer.sns.enabled,
    socialLinks: userLayoutUiConfig.footer.sns.links,
    linksEnabled: userLayoutConfig.footer.linksEnabled,
    footerLinks: userLayoutConfig.footer.links,
    linkSeparator: userLayoutConfig.footer.linkSeparator,
    copyrightEnabled: userLayoutConfig.footer.copyright.enabled,
    copyrightText,
    visibilityClass,
  };
};
