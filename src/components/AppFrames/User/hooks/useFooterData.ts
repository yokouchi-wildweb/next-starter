/**
 * カスタムフッター用のデータを提供するフック
 *
 * 設定ファイル: src/config/ui/user-footer.config.ts
 */

"use client";

import { useMemo } from "react";

import { businessConfig } from "@/config/business.config";
import {
  COPYRIGHT_CUSTOM_TEXT,
  COPYRIGHT_ENABLED,
  COPYRIGHT_FORMAT,
  COPYRIGHT_YEAR,
  FOOTER_ENABLED,
  FOOTER_LINK_SEPARATOR,
  FOOTER_LINKS,
  FOOTER_LINKS_ENABLED,
  FOOTER_VISIBILITY,
  SNS_ENABLED,
  SOCIAL_LINKS,
  type FooterLinkItem,
  type SocialLinkItem,
} from "@/config/ui/user-footer.config";

import { useFooterVisibility } from "../contexts/FooterVisibilityContext";

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
  /** フッターの表示状態（SP/PC、設定とContextの両方を考慮） */
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
  /** SP/PC両方の表示クラス */
  visibilityClass: string;
};

// ============================================
// ユーティリティ
// ============================================

/**
 * コピーライトテキストを生成
 */
function getCopyrightText(): string {
  const year = COPYRIGHT_YEAR;
  const serviceName = businessConfig.serviceName;

  switch (COPYRIGHT_FORMAT) {
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
      return COPYRIGHT_CUSTOM_TEXT.replace("{year}", year).replace(
        "{serviceName}",
        serviceName
      );
    default:
      return `© ${year} ${serviceName}`;
  }
}

// ============================================
// フック実装
// ============================================

export const useFooterData = (): UseFooterDataReturn => {
  // Context からの表示状態
  const { visibility: contextVisibility } = useFooterVisibility();

  // 設定とコンテキストの両方を考慮した表示判定
  const visibility = useMemo<DeviceVisibility>(
    () => ({
      sp: FOOTER_VISIBILITY.sp && contextVisibility.sp,
      pc: FOOTER_VISIBILITY.pc && contextVisibility.pc,
    }),
    [contextVisibility.sp, contextVisibility.pc]
  );

  // 表示/非表示のクラスを決定
  const visibilityClass = useMemo(() => {
    if (!visibility.sp && !visibility.pc) return "hidden";
    if (!visibility.sp && visibility.pc) return "hidden sm:flex";
    if (visibility.sp && !visibility.pc) return "flex sm:hidden";
    return "flex";
  }, [visibility.sp, visibility.pc]);

  // コピーライトテキスト（メモ化）
  const copyrightText = useMemo(() => getCopyrightText(), []);

  return {
    enabled: FOOTER_ENABLED,
    visibility,
    snsEnabled: SNS_ENABLED,
    socialLinks: SOCIAL_LINKS,
    linksEnabled: FOOTER_LINKS_ENABLED,
    footerLinks: FOOTER_LINKS,
    linkSeparator: FOOTER_LINK_SEPARATOR,
    copyrightEnabled: COPYRIGHT_ENABLED,
    copyrightText,
    visibilityClass,
  };
};
