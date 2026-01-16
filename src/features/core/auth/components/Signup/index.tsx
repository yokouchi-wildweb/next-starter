// src/features/auth/components/Signup/index.tsx

// サインアップ画面全体を表すセクションコンテナです。
// Server Component として機能し、個別のサインアップ手段は子コンポーネントに委譲します。

import Link from "next/link";

import { VerificationEmailSendForm } from "./EmailVarification/sendForm";
import { ThirdPartySignupOptions } from "./ThirdPartySignupOptions";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";

export type SignupProps = {
  urlAfterEmailSent: string;
};

export function Signup({ urlAfterEmailSent }: SignupProps) {
  return (
    <Section id="signup">
      <Block space="xl">
        <VerificationEmailSendForm urlAfterEmailSent={urlAfterEmailSent} />
        <ThirdPartySignupOptions />

        <div className="mt-8">
          <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/login">
              ログインはこちら <span className="ml-1 text-xs">▶</span>
            </Link>
          </Button>
        </div>
      </Block>
    </Section>
  );
}
