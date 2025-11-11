// src/features/auth/components/Signup/index.tsx

// サインアップ画面全体を表すセクションコンテナです。
// Server Component として機能し、個別のサインアップ手段は子コンポーネントに委譲します。

import { VerificationEmailSendForm } from "./EmailVarification/sendForm";
import { ThirdPartySignupOptions } from "./ThirdPartySignupOptions";

import { Block } from "@/components/Layout/Block";
import { Para, SecTitle, Section } from "@/components/TextBlocks";

export type SignupProps = {
  urlAfterEmailSent: string;
};

export function Signup({ urlAfterEmailSent }: SignupProps) {
  return (
    <Section id="signup">
      <Block space="lg">
        <VerificationEmailSendForm urlAfterEmailSent={urlAfterEmailSent} />
        <ThirdPartySignupOptions />
      </Block>
    </Section>
  );
}
