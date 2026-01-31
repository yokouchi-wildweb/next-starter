// src/app/(marketing)/entry/_components/EntrySignupSection.tsx
// 事前登録フォームセクション

import Link from "next/link";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle } from "@/components/TextBlocks";
import { EarlyRegistrationSendForm } from "@/features/core/auth/components/Signup/EarlyRegistration/SendForm";
import { ThirdPartySignupOptions } from "@/features/core/auth/components/Signup/ThirdPartySignupOptions";

export function EntrySignupSection() {
  // 事前登録完了後のリダイレクト先
  // 必要に応じて専用の完了ページを作成可能
  const emailSentUrl = "/signup/email-sent";

  return (
    <Section id="entry-signup" paddingBlock="lg">
      <Stack space={6} className="mx-auto max-w-md">
        <SecTitle as="h2" size="lg" align="center">
          事前登録はこちら
        </SecTitle>

        <Stack space={6}>
          <EarlyRegistrationSendForm urlAfterEmailSent={emailSentUrl} />
          <ThirdPartySignupOptions />

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
            、
            <Link href="/privacy-policy" className="text-primary hover:underline">プライバシーポリシー</Link>
            に
            <br />
            同意の上、ご登録ください。
          </p>
        </Stack>
      </Stack>
    </Section>
  );
}
