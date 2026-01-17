// src/features/auth/components/Signup/index.tsx

// サインアップ画面全体を表すセクションコンテナです。
// Server Component として機能し、個別のサインアップ手段は子コンポーネントに委譲します。

import Link from "next/link";

import { VerificationEmailSendForm } from "./EmailVarification/sendForm";
import { ThirdPartySignupOptions } from "./ThirdPartySignupOptions";

import { Button } from "@/components/Form/Button/Button";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";

export type SignupProps = {
  urlAfterEmailSent: string;
};

export function Signup({ urlAfterEmailSent }: SignupProps) {
  return (
    <Section id="signup">
      <Stack space={6}>
        <VerificationEmailSendForm urlAfterEmailSent={urlAfterEmailSent} />
        <ThirdPartySignupOptions />

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
          、
          <Link href="/privacy-policy" className="text-primary hover:underline">プライバシーポリシー</Link>
          に
          <br />
          同意の上、ご登録ください。
        </p>

        <div className="mt-6 border-t border-muted-foreground pt-6">
          <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/login">
              ログインはこちら <span className="ml-1 text-xs">▶</span>
            </Link>
          </Button>
        </div>
      </Stack>
    </Section>
  );
}
