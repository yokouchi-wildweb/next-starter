// src/wiring/AppProviders.tsx
//
// アプリ全体を包む Provider の入れ子(server)。root の src/app/layout.tsx がこれを 1 か所で描く。
// client の Provider を並べるだけで、自分ではデータを取らない。データに届くのは AuthSessionProvider
// (Cookie の解析とセッション解決。ページのデータ・セッションを読む場所の名前付き例外)だけ。
// 並び(外 → 内): 門番(GateProvider、root layout が計算した利用者の枠の値を prop gate で受ける。管理の枠は admin の守りの layout が包み直す)→ Tooltip → reCAPTCHA → 認証セッション → 管理コマンド → 画像ビューア → 入力部品 → 未保存の編集の守り(src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx: 確認の Dialog と棚の Navigation の口)→ fork の口(src/app/_providers/ForkProviders.tsx、
// 上流は空。fork が自分の Provider を足す、D30 K8)。設計: src/wiring/README.md

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/Overlays/Tooltip";
import { RecaptchaProvider } from "@/components/Providers/RecaptchaProvider";
import { ImageViewerProvider } from "@/components/Overlays/ImageViewer/Provider";
import { AdminCommandRoot } from "@/app/_layout/adminCommand/AdminCommandRoot";
import { UnsavedGuardRoot } from "@/app/_layout/unsavedGuard/UnsavedGuardRoot";
import { AuthSessionProvider } from "@/features/core/auth/components/AuthSessionProvider";
import { ForkProviders } from "@/app/_providers/ForkProviders";
import { FormInputsRoot } from "@/wiring/formInputs/FormInputsRoot";
import { GateProvider, type ClientGateState } from "@/featureGate/client";

export function AppProviders({
  children,
  gate,
}: Readonly<{ children: ReactNode; gate: ClientGateState }>) {
  return (
    <GateProvider state={gate}>
      <TooltipProvider>
        <RecaptchaProvider>
          <AuthSessionProvider>
            <AdminCommandRoot>
              <ImageViewerProvider>
                <FormInputsRoot>
                  <UnsavedGuardRoot>
                    <ForkProviders>{children}</ForkProviders>
                  </UnsavedGuardRoot>
                </FormInputsRoot>
              </ImageViewerProvider>
            </AdminCommandRoot>
          </AuthSessionProvider>
        </RecaptchaProvider>
      </TooltipProvider>
    </GateProvider>
  );
}
