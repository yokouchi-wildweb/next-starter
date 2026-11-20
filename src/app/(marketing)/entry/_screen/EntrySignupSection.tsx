// src/app/(marketing)/entry/_screen/EntrySignupSection.tsx
// 事前登録フォームセクション

import { Link } from "@/components/Navigation/Link";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";
import { EarlyRegistrationSendForm, ThirdPartySignupOptions } from "@/features/core/auth/components/Signup";

export function EntrySignupSection() {
  // 事前登録完了後のリダイレクト先
  // 必要に応じて専用の完了ページを作成可能
  const emailSentUrl = "/signup/email-sent";

  return (
    <Section id="entry-signup" paddingBlock={{ base: "md", sm: "lg" }}>
      <Stack gap="lg" className="mx-auto max-w-md">
        <SecTitle as="h2" size="lg" align="center">
          事前登録はこちら
        </SecTitle>

        <Stack gap="lg">
          <EarlyRegistrationSendForm urlAfterEmailSent={emailSentUrl} />
          <ThirdPartySignupOptions />

          <Para size="xs" tone="muted" align="center" className="my-0">
            <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
            、
            <Link href="/privacy-policy" className="text-primary hover:underline">プライバシーポリシー</Link>
            に
            <br />
            同意の上、ご登録ください。
          </Para>
        </Stack>
      </Stack>
    </Section>
  );
}
