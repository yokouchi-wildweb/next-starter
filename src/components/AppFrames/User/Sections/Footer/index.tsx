"use client";

import { cva } from "class-variance-authority";

import { APP_FOOTER_ELEMENT_ID } from "@/constants/layout";
import { cn } from "@/lib/cn";
import { businessConfig } from "@/config/business.config";

import { useFooterVisibility } from "../../contexts/FooterVisibilityContext";

const footerClass = cva(
  "h-12 flex items-center justify-center px-6 bg-background text-foreground shadow-inner text-sm",
);

export function UserFooter() {
  const { visibility } = useFooterVisibility();

  // 表示/非表示のクラスを決定
  const visibilityClass = (() => {
    if (!visibility.sp && !visibility.pc) return "hidden";
    if (!visibility.sp && visibility.pc) return "hidden sm:flex";
    if (visibility.sp && !visibility.pc) return "flex sm:hidden";
    return "";
  })();

  const year = new Date().getFullYear();
  const footerText = `© ${year} ${businessConfig.serviceName}`;

  return (
    <footer
      id={APP_FOOTER_ELEMENT_ID}
      className={cn(footerClass(), visibilityClass)}
    >
      {footerText}
    </footer>
  );
}
