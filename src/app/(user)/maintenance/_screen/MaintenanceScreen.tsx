// src/app/(user)/maintenance/_screen/MaintenanceScreen.tsx
// /maintenance の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (loader の import は ../_screen/loader に、部品の import は ../_screen/MaintenanceAutoRedirect に直す)。手順: src/lib/screens/README.md
//
// ヘッダー・フッター・ボトムナビを隠した 1 画面の案内。終了時刻は loader が設定から読み、
// MaintenanceAutoRedirect(client 部品)が時刻到来で遷移する。

import type { ScreenProps } from "@/lib/screens/types";
import { HideHeaderNav, HideFooter, HideBottomNav } from "@/components/AppFrames/User/controls";
import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

import { loadMaintenanceScreen } from "./loader";
import { MaintenanceAutoRedirect } from "./MaintenanceAutoRedirect";

export async function MaintenanceScreen(props: ScreenProps) {
  const { endTime, redirectTo } = await loadMaintenanceScreen(props);

  return (
    <>
      <MaintenanceAutoRedirect endTime={endTime} redirectTo={redirectTo} />
      <UserPage>
        <HideHeaderNav />
        <HideFooter />
        <HideBottomNav />
        <Stack space={8} className="text-center py-12">
          <UserPageTitle>ただいま準備中です</UserPageTitle>
          <Para align="center" tone="muted">現在サイトを準備しております。</Para>
          <Para align="center" tone="muted">サービス開始までしばらくお待ちください。</Para>
        </Stack>
      </UserPage>
    </>
  );
}
