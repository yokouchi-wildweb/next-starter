// src/app/(user)/(protected)/mypage/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";
import { LogoutButton } from "@/features/core/auth/components/common/LogoutButton";
import UserMyPageView from "@/features/core/user/components/UserMyPage";
import { requireCurrentUser } from "@/features/core/user/services/server/userService";

export default async function UserMyPagePage() {
  const user = await requireCurrentUser({ behavior: "returnNull" });

  if (!user) {
    return (
      <UserPage>
        <Stack space={6}>
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
        </Stack>
      </UserPage>
    );
  }

  return (
    <UserPage>
      <Stack space={6}>
        <UserPageTitle>マイページ</UserPageTitle>
        <UserMyPageView user={user} />
      </Stack>
    </UserPage>
  );
}
