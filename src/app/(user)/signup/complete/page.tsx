// src/app/(user)/signup/complete/page.tsx

import Link from "next/link";

import { Main, PageTitle, Para, Section } from "@/components/TextBlocks";
import { Button } from "@/components/Form/button/Button";
import { Block } from "@/components/Layout/Block";

export default function SignUpCompletePage() {
  return (
    <Main variant="narrowStack">
      <Section as="header">
        <PageTitle>本登録が完了しました</PageTitle>
      </Section>
      <Para>ご登録ありがとうございます。引き続きアプリをお楽しみください。</Para>

      <Block>
        <Button asChild>
          <Link href="/">トップに戻る</Link>
        </Button>
      </Block>

    </Main>
  );
}

