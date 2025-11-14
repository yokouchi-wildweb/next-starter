// src/features/user/components/UserProfileEdit/index.tsx

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import type { User } from "@/features/user/entities";

import { EmailUserProfileForm } from "../common/EmailUserProfileForm";
import { OauthUserProfileForm } from "../common/OauthUserProfileForm";

type Props = {
  user: User;
};

function resolveContent(user: User) {
  if (user.providerType === "local") {
    return (
      <Para>
        現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。
      </Para>
    );
  }

  if (user.providerType === "email") {
    return <EmailUserProfileForm user={user} />;
  }

  return <OauthUserProfileForm user={user} />;
}

export default function UserProfileEdit({ user }: Props) {
  return (
    <Main containerType="contentShell" className="gap-6">
      <PageTitle>プロフィール編集</PageTitle>
      <Section>
        <Para>ユーザーのプロフィール情報を更新できます。</Para>
      </Section>
      <Section className="space-y-4">
        <SecTitle as="h2">プロフィール設定</SecTitle>
        <div className="rounded-lg border border-border bg-card p-4">
          {resolveContent(user)}
        </div>
      </Section>
    </Main>
  );
}
