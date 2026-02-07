// src/features/core/user/components/UserMyPage/AccountDetails.tsx

import Link from "next/link";
import { UserPenIcon, MailIcon, LockIcon, CheckCircleIcon, PhoneIcon, ChevronRightIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { APP_FEATURES } from "@/config/app/app-features.config";
import type { User } from "@/features/core/user/entities";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";

import { AccountPageHeader } from "./AccountPageHeader";

type AccountDetailsProps = {
  user: User;
};

type AccountDetailItemProps = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
};

function AccountDetailItem({ href, icon: Icon, label, value }: AccountDetailItemProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {value}
          </p>
        </div>
      </div>
      <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

export function AccountDetails({ user }: AccountDetailsProps) {
  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader title="アカウント基本情報" backHref="/mypage" />
        <div className="grid grid-cols-1 gap-3">
          <AccountDetailItem
            href="/mypage/account/name"
            icon={UserPenIcon}
            label="ユーザー名"
            value={user.name ?? "未設定"}
          />
          <AccountDetailItem
            href="/mypage/account/email"
            icon={MailIcon}
            label="メールアドレス"
            value={
              user.email ? (
                <>
                  {user.email}
                  <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                </>
              ) : (
                "未設定"
              )
            }
          />
          {APP_FEATURES.user.phoneVerificationEnabled && (
            <AccountDetailItem
              href="/mypage/account/phone"
              icon={PhoneIcon}
              label="電話番号"
              value={
                user.phoneVerifiedAt ? (
                  <>
                    {formatForDisplay(user.phoneNumber ?? "")}
                    <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" />
                  </>
                ) : (
                  "未認証"
                )
              }
            />
          )}
          {user.providerType === "email" && (
            <AccountDetailItem
              href="/mypage/account/password"
              icon={LockIcon}
              label="パスワード"
              value="パスワードを変更"
            />
          )}
        </div>
      </Stack>
    </Section>
  );
}
