// src/app/(user)/(auth)/signup/complete/page.tsx

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";

export default function SignUpCompletePage() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>本登録が完了しました</UserPageTitle>
      <Para>ご登録ありがとうございます。引き続きアプリをお楽しみください。</Para>

      <Block>
        <Button asChild>
          <Link href="/">トップに戻る</Link>
        </Button>
      </Block>

    </UserPage>
  );
}

