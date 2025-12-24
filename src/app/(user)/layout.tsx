import type { ReactNode } from "react";

import { UserAppLayout } from "@/components/AppFrames/User/Layout/UserLayout";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { imgPath } from "@/utils/assets";

// 背景設定
const backgroundImageUrl = ""; // 背景画像のURL（例: imgPath("backgrounds/user-bg.jpg")）
const overlayColor = "#000"; // オーバーレイの色（任意のCSS色形式: "#000", "black", "rgb(0,0,0)"など）
const overlayOpacity = 0; // オーバーレイの透明度（0-1）

export default async function UserLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const setting = await settingService.getGlobalSetting();

  return (
    <UserAppLayout
      backgroundImageUrl={backgroundImageUrl || undefined}
      overlayColor={overlayColor}
      overlayOpacity={overlayOpacity}
    >
      {children}
    </UserAppLayout>
  );
}
