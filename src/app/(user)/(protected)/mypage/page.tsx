// src/app/(user)/(protected)/mypage/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks";
import { LogoutButton } from "@/features/core/auth/components/common/LogoutButton";
import { MainMenu } from "@/features/core/user/components/UserMyPage/MainMenu";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser({ behavior: "returnNull" });

  if (!user) {
    return (
      <>
        <UserPageTitle>マイページ</UserPageTitle>
        <Block appearance="outlined" padding="lg">
          <Flex direction="column" align="center" gap="md">
            <Para>ユーザー情報が参照できません</Para>
            <Para tone="muted" size="sm">
              不具合を解消するにはログアウト後、再ログインしてください。
            </Para>
            <LogoutButton redirectTo="/" />
          </Flex>
        </Block>
      </>
    );
  }

  return (
    <>
      <UserPageTitle>マイページ</UserPageTitle>
      <MainMenu />
    </>
  );
}
