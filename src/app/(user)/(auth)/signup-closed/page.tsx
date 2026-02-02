// src/app/(user)/(auth)/signup-closed/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

export default function SignupClosedPage() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>会員登録 受付停止中</UserPageTitle>
      <Para>新規会員登録の受付を停止しております。</Para>
      <Stack space={3} className="mt-6">
        <LinkButton href="/login" variant="default">
          ログインはこちら
        </LinkButton>
        <LinkButton href="/" variant="outline">
          トップページへ戻る
        </LinkButton>
      </Stack>
    </UserPage>
  );
}
