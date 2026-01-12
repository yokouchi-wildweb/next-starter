/**
 * カスタムフッター スケルトンテンプレート
 *
 * このファイルを編集してプロジェクト固有のフッターを作成してください。
 * useFooterData フックにより、設定ファイルからのデータ取得は全て提供されます。
 *
 * 使用方法:
 * 1. このファイルを編集してデザインをカスタマイズ
 * 2. src/config/ui/user-footer.config.ts の export を切り替え:
 *    export { UserFooter } from "@/components/AppFrames/User/Sections/FooterCustom";
 */

"use client";

import Link from "next/link";

import { APP_FOOTER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { cn } from "@/lib/cn";
import { useFooterData } from "../../hooks";

export function UserFooter() {
  const {
    enabled,
    visibilityClass,
    snsEnabled,
    socialLinks,
    linksEnabled,
    footerLinks,
    linkSeparator,
    copyrightEnabled,
    copyrightText,
  } = useFooterData();

  // フッターが無効な場合は何も表示しない
  if (!enabled) {
    return null;
  }

  return (
    <footer
      id={APP_FOOTER_ELEMENT_ID}
      className={cn(
        "flex-col items-center justify-center gap-4 bg-background px-6 py-8",
        visibilityClass
      )}
    >
      {/* SNSリンク */}
      {snsEnabled && socialLinks.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          {socialLinks.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <item.icon className="size-5" />
            </Link>
          ))}
        </div>
      )}

      {/* フッターリンク */}
      {linksEnabled && footerLinks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          {footerLinks.map((item, index) => (
            <span key={item.key} className="flex items-center gap-2">
              <Link
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
              {index < footerLinks.length - 1 && (
                <span className="text-muted-foreground/50">{linkSeparator}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* コピーライト */}
      {copyrightEnabled && (
        <p className="text-center text-xs text-muted-foreground">
          {copyrightText}
        </p>
      )}
    </footer>
  );
}
