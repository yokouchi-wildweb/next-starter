// src/app/(user)/(auth)/signup/error.tsx

"use client";

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";

export default function SignUpError() {
  return (
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle>登録エラー</UserPageTitle>
      <Para align="center">
        セッションの問題、不正なアクセスが検出されました。<br />
        お手数ですが最初からやり直してください。
      </Para>

      <Block>
        <Button asChild>
          <Link href="/signup">新規登録ページに戻る</Link>
        </Button>
      </Block>
    </UserPage>
  );
}
