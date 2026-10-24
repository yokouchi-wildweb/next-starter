// マイページ配下の枠(遷移をまたいで残るページコンテナ)。mypage/layout.tsx が 1 行スイッチで default に束ねる
// fork の差し替え: 隣にドット区切り名のカスタム(例 MyPageLayout.<project>.tsx)を置き、layout.tsx をそちらへ向ける

import type { ReactNode } from "react";

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Stack } from "@/components/Layout/Stack";
import { PageTransition } from "@/components/Animation/PageTransition";

export function MyPageLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <UserPage containerType="narrowStack">
      <Stack space={6}>
        <PageTransition>{children}</PageTransition>
      </Stack>
    </UserPage>
  );
}
