// src/wiring/AppProviders.tsx
//
// アプリ全体を包む Provider の入れ子(server)。root の src/app/layout.tsx がこれを 1 か所で描く。
// client の Provider を並べるだけで、自分ではデータを取らない。ドメインは読まない(D22・D25): ドメインの Provider は根の枠の点 rootProviders の項目
// (生成された一覧 @/app/_layout/extensions/rootProviders、門番で絞る)で、上流は auth の認証セッション(段 session、データに届く名前付き例外)と
// adminCommand の管理者コマンド(段 domain)。fork の Provider も自分のドメインの項目(段 project、前の ForkProviders、注文 32)。
// 並び(外 → 内): 門番(GateProvider、root layout が計算した利用者の枠の値を prop gate で受ける。管理の枠は admin の守りの layout が包み直す)→
// 骨組み outer(Tooltip → reCAPTCHA)→ 段 session → 段 domain → 骨組み inner(画像ビューア → 入力部品 → 未保存の編集の守り
// src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx)→ 段 project。並べ方: src/app/_layout/rootProviders.ts。設計: src/wiring/README.md

import type { ReactNode } from "react";

import { TooltipProvider } from "@/components/Overlays/Tooltip";
import { RecaptchaProvider } from "@/lib/recaptcha";
import { ImageViewerProvider } from "@/components/Overlays/ImageViewer";
import { rootProviders } from "@/app/_layout/extensions/rootProviders";
import { orderRootProviders } from "@/app/_layout/rootProviders";
import { UnsavedGuardRoot } from "@/app/_layout/unsavedGuard/UnsavedGuardRoot";
import { gate as serverGate } from "@/featureGate";
import { FormInputsRoot } from "@/wiring/formSuite";
import { GateProvider, type ClientGateState } from "@/featureGate/client";
import { HttpDefaultsRoot } from "@/lib/httpDefaults";

/** 入れ子の並び(外 → 内)。一覧は門番で閉じたドメインの Provider を外してから(サーバーの門番はプロセスごとに固定) */
const providers = orderRootProviders(
  { outer: [TooltipProvider, RecaptchaProvider], inner: [ImageViewerProvider, FormInputsRoot, UnsavedGuardRoot] },
  serverGate.plugs(rootProviders),
);

export function AppProviders({
  children,
  gate,
}: Readonly<{ children: ReactNode; gate: ClientGateState }>) {
  return (
    <GateProvider state={gate}>
      {/* client の既定の axios に既定のタイムアウト(src/lib/httpDefaults、設定が無ければ何もしない) */}
      <HttpDefaultsRoot />
      {providers.reduceRight<ReactNode>((inner, Provider) => <Provider>{inner}</Provider>, children)}
    </GateProvider>
  );
}
