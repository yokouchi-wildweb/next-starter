// src/features/auth/components/UserLogin/index.tsx

// ログイン画面のセクションコンテナ。メールのフォーム(UserLoginEmailForm)と外部のログインの手段(ThirdPartySignupOptions)を並べる。
// 並べ方を変える fork は自分の Screen(_components/)で UserLoginEmailForm と自分の手段を並べる

"use client";

import { Link } from "@/components/Navigation";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";

import { ThirdPartySignupOptions } from "@/features/core/auth/components/Signup";

import { UserLoginEmailForm } from "./UserLoginEmailForm";

export { UserLoginEmailForm, type UserLoginEmailFormProps } from "./UserLoginEmailForm";

export type UserLoginProps = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function UserLogin({ redirectTo = DEFAULT_REDIRECT_PATH }: UserLoginProps) {
  return (
    <Section id="user-login" className="w-full">
      <Stack gap="xl">

        <UserLoginEmailForm redirectTo={redirectTo} />
        <ThirdPartySignupOptions redirectTo={redirectTo} />
        <Block className="mt-8">
          <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/signup">
              新規での会員登録はこちら <Span size="xs" weight="inherit" className="ml-1">▶</Span>
            </Link>
          </Button>
        </Block>
      </Stack>
    </Section>
  );
}
