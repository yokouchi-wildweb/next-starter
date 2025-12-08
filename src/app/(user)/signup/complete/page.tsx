// src/app/(user)/signup/complete/page.tsx

import Link from "next/link";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle, Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";

export default function SignUpCompletePage() {
  return (
    <UserPage containerType="narrowStack">
      <Section as="header">
        <PageTitle>本登録が完了しました</PageTitle>
      </Section>
      <Para>ご登録ありがとうございます。引き続きアプリをお楽しみください。</Para>

      <Block>
        <Button asChild>
          <Link href="/">トップに戻る</Link>
        </Button>
      </Block>

    </UserPage>
  );
}

