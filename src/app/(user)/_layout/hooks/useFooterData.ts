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
  /** フッターの表示設定（SP/PC、config の FOOTER_VISIBILITY。ページ単位で隠すのは Hide* の印の CSS） */
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
  /** FOOTER_VISIBILITY から作る SP/PC の表示クラス */
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

/**
 * FOOTER_VISIBILITY から作る表示クラス。
 * 描画時に呼ぶこと: config(user-footer.config)が UserFooter を re-export しており、config → Footer → この hook → config の
 * 循環 import になるため、モジュールの読み込み時に FOOTER_VISIBILITY を読むと初期化前(TDZ)で落ちる
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
  const visibility: DeviceVisibility = FOOTER_VISIBILITY;
  const visibilityClass = getFooterVisibilityClass(visibility);

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
