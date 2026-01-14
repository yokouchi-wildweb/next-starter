// src/features/user/components/UserProfileEdit/index.tsx

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";
import type { User } from "@/features/core/user/entities";

import { UserProfileForm } from "../forms/UserProfileForm";

type Props = {
  user: User;
  profileData?: Record<string, unknown>;
};

export default function UserProfileEdit({ user, profileData }: Props) {
  return (
    <>
      <Section>
        <Para>ユーザーのプロフィール情報を更新できます。</Para>
      </Section>
      <Section space="sm">
        <SecTitle as="h2">プロフィール設定</SecTitle>
        <Block appearance="outlined" padding="lg">
          <UserProfileForm user={user} profileData={profileData} />
        </Block>
      </Section>
    </>
  );
}
