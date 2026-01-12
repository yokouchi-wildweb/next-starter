"use client";

import Link from "next/link";

import { APP_FOOTER_ELEMENT_ID } from "@/components/AppFrames/constants";
import { cn } from "@/lib/cn";
import { businessConfig } from "@/config/business.config";
import {
  FOOTER_ENABLED,
  FOOTER_VISIBILITY,
  SNS_ENABLED,
  SOCIAL_LINKS,
  FOOTER_LINKS_ENABLED,
  FOOTER_LINKS,
  FOOTER_LINK_SEPARATOR,
  COPYRIGHT_ENABLED,
  COPYRIGHT_YEAR,
  COPYRIGHT_FORMAT,
  COPYRIGHT_CUSTOM_TEXT,
} from "@/config/ui/user-footer.config";

import { useFooterVisibility } from "../../contexts/FooterVisibilityContext";

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
        serviceName,
      );
    default:
      return `© ${year} ${serviceName}`;
  }
}

export function UserFooter() {
  const { visibility } = useFooterVisibility();

  // フッターが無効な場合は何も表示しない
  if (!FOOTER_ENABLED) {
    return null;
  }

  // 設定とコンテキストの両方を考慮した表示判定
  const showSp = FOOTER_VISIBILITY.sp && visibility.sp;
  const showPc = FOOTER_VISIBILITY.pc && visibility.pc;

  // 表示/非表示のクラスを決定
  const visibilityClass = (() => {
    if (!showSp && !showPc) return "hidden";
    if (!showSp && showPc) return "hidden sm:flex";
    if (showSp && !showPc) return "flex sm:hidden";
    return "flex";
  })();

  return (
    <footer
      id={APP_FOOTER_ELEMENT_ID}
      className={cn(
        "flex-col items-center justify-center gap-4 bg-background px-6 py-6 text-foreground shadow-inner",
        visibilityClass,
      )}
    >
      {/* SNSリンク */}
      {SNS_ENABLED && SOCIAL_LINKS.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          {SOCIAL_LINKS.map((item) => (
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
      {FOOTER_LINKS_ENABLED && FOOTER_LINKS.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          {FOOTER_LINKS.map((item, index) => (
            <span key={item.key} className="flex items-center gap-2">
              <Link
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
              {index < FOOTER_LINKS.length - 1 && (
                <span className="text-muted-foreground/50">
                  {FOOTER_LINK_SEPARATOR}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* コピーライト */}
      {COPYRIGHT_ENABLED && (
        <p className="text-center text-xs text-muted-foreground">
          {getCopyrightText()}
        </p>
      )}
    </footer>
  );
}
