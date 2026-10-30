// src/wiring/AppProviders.tsx
//
// アプリ全体を包む Provider の入れ子(server)。root の src/app/layout.tsx がこれを 1 か所で描く。
// client の Provider を並べるだけで、自分ではデータを取らない。データに届くのは AuthSessionProvider
// (Cookie の解析とセッション解決。ページのデータ・セッションを読む場所の名前付き例外)だけ。
// 並び(外 → 内): Tooltip → reCAPTCHA → 認証セッション → 管理コマンド → 画像ビューア。設計: src/wiring/README.md

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/Overlays/Tooltip";
import { RecaptchaProvider } from "@/components/Providers/RecaptchaProvider";
import { ImageViewerProvider } from "@/components/Overlays/ImageViewer/Provider";
import { AdminCommandProvider } from "@/features/core/adminCommand";
import { AuthSessionProvider } from "@/features/core/auth/components/AuthSessionProvider";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <TooltipProvider>
      <RecaptchaProvider>
        <AuthSessionProvider>
          <AdminCommandProvider>
            <ImageViewerProvider>{children}</ImageViewerProvider>
          </AdminCommandProvider>
        </AuthSessionProvider>
      </RecaptchaProvider>
    </TooltipProvider>
  );
}
