// src/features/user/components/UserMyPage/index.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Para, SecTitle } from "@/components/TextBlocks";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { USER_ROLE_OPTIONS } from "@/constants/user";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/types/user";
import { formatDateJa } from "@/utils/date";
import { formatUserStatusLabel } from "@/features/core/user/constants/status";

import { UserInfoTable, type UserInfoRow } from "./UserInfoTable";

type UserMyPageProps = {
  user: User;
};

const roleLabelMap = new Map<UserRoleType, string>(USER_ROLE_OPTIONS.map((option) => [option.id, option.name]));

function resolveRoleLabel(role: UserRoleType): string {
  return roleLabelMap.get(role) ?? role;
}

function formatLastAuthenticatedAt(date: User["lastAuthenticatedAt"]): string {
  if (!date) {
    return "未認証";
  }

  return formatDateJa(date, {
    format: "YYYY/MM/DD HH:mm",
    fallback: "未認証",
  }) ?? "未認証";
}

export default function UserMyPage({ user }: UserMyPageProps) {
  const rows: UserInfoRow[] = [
    { label: "ユーザーID", value: user.id },
    { label: "表示名", value: user.displayName ?? "未設定" },
    { label: "権限", value: resolveRoleLabel(user.role) },
    { label: "ステータス", value: formatUserStatusLabel(user.status, user.status ?? "未設定") },
    { label: "プロバイダータイプ", value: user.providerType },
    { label: "メールアドレス", value: user.email ?? "未設定" },
    { label: "最終認証日時", value: formatLastAuthenticatedAt(user.lastAuthenticatedAt) },
  ];

  return (
    <>
      <Flex justify="end" gap="sm">
        <LinkButton variant="outline" href="/profile/edit">
          プロフィールを編集
        </LinkButton>
        <LinkButton variant="outline" href="/coins">
          コイン管理
        </LinkButton>
      </Flex>
      <Section>
        <Para>このページはログイン状態のユーザーのみがアクセスできる想定で設計されているメンバー専用ページです。</Para>
      </Section>
      <Section space="sm">
        <SecTitle as="h2">アカウント情報</SecTitle>
        <Block appearance="outlined" padding="lg">
          <UserInfoTable rows={rows} />
        </Block>
      </Section>
    </>
  );
}
