// src/features/auth/components/Signup/index.tsx

// サインアップ画面全体を表すセクションコンテナです。
// Server Component として機能し、個別のサインアップ手段は子コンポーネントに委譲します。

import { Link } from "@/components/Navigation/Link";

import { VerificationEmailSendForm } from "./EmailVarification/sendForm";
import { ThirdPartySignupOptions } from "./ThirdPartySignupOptions";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";

export { EarlyRegistrationSendForm } from "./EarlyRegistration/SendForm";
export { ThirdPartySignupOptions } from "./ThirdPartySignupOptions";
export { VerificationEmailSendForm } from "./EmailVarification/sendForm";

export type SignupProps = {
  urlAfterEmailSent: string;
};

export function Signup({ urlAfterEmailSent }: SignupProps) {
  return (
    <Section id="signup">
      <Stack gap="lg">
        <VerificationEmailSendForm urlAfterEmailSent={urlAfterEmailSent} />
        <ThirdPartySignupOptions />

        <Para size="xs" tone="muted" align="center" className="my-0">
          <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
          、
          <Link href="/privacy-policy" className="text-primary hover:underline">プライバシーポリシー</Link>
          に
          <br />
          同意の上、ご登録ください。
        </Para>

        <Block className="mt-6 border-t border-muted-foreground pt-6">
          <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/login">
              ログインはこちら <Span size="xs" weight="inherit" className="ml-1">▶</Span>
            </Link>
          </Button>
        </Block>
      </Stack>
    </Section>
  );
}
