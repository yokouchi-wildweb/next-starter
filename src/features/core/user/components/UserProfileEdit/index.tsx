// src/features/user/components/UserProfileEdit/index.tsx

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";
import type { User } from "@/features/core/user/entities";

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
    <>
      <Section>
        <Para>ユーザーのプロフィール情報を更新できます。</Para>
      </Section>
      <Section space="sm">
        <SecTitle as="h2">プロフィール設定</SecTitle>
        <Block appearance="outlined" padding="lg">
          {resolveContent(user)}
        </Block>
      </Section>
    </>
  );
}
