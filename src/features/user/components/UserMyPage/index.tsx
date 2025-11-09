// src/features/user/components/UserMyPage/index.tsx

import { Main, PageTitle, Para, Section, SecTitle } from "@/components/TextBlocks";
import { USER_ROLE_OPTIONS } from "@/constants/user";
import type { User } from "@/features/user/entities";
import type { UserRoleType, UserStatus } from "@/types/user";
import { formatDateJa } from "@/utils/date";

import { UserInfoTable, type UserInfoRow } from "./UserInfoTable";

type UserMyPageProps = {
  user: User;
};

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: "仮登録",
  active: "有効",
  inactive: "停止中",
  locked: "ロック中",
};

const roleLabelMap = new Map<UserRoleType, string>(USER_ROLE_OPTIONS.map((option) => [option.id, option.name]));

function resolveRoleLabel(role: UserRoleType): string {
  return roleLabelMap.get(role) ?? role;
}

function resolveStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABELS[status] ?? status;
}

function formatLastAuthenticatedAt(date: User["lastAuthenticatedAt"]): string {
  if (!date) {
    return "未認証";
  }

  return formatDateJa(date, {
    format: "YYYY/MM/DD HH:mm",
    fallback: "未認証",
  });
}

export default function UserMyPage({ user }: UserMyPageProps) {
  const rows: UserInfoRow[] = [
    { label: "ユーザーID", value: user.id },
    { label: "表示名", value: user.displayName ?? "未設定" },
    { label: "権限", value: resolveRoleLabel(user.role) },
    { label: "ステータス", value: resolveStatusLabel(user.status) },
    { label: "プロバイダータイプ", value: user.providerType },
    { label: "メールアドレス", value: user.email ?? "未設定" },
    { label: "最終認証日時", value: formatLastAuthenticatedAt(user.lastAuthenticatedAt) },
  ];

  return (
    <Main variant="contentShell" className="gap-6">
      <PageTitle>マイページ</PageTitle>
      <Section variant="compact" className="space-y-3">
        <Para>このページはログイン状態のユーザーのみがアクセスできる想定で設計されているメンバー専用ページです。</Para>
      </Section>
      <Section className="space-y-4">
        <SecTitle as="h2">アカウント情報</SecTitle>
        <div className="rounded-lg border border-border bg-card p-4">
          <UserInfoTable rows={rows} />
        </div>
      </Section>
    </Main>
  );
}
