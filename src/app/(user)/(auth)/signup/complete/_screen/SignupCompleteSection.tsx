// src/app/(user)/(auth)/signup/complete/_screen/SignupCompleteSection.tsx
// 本登録完了の本文(既定 Screen 専用、契約外)。処理(遷移の守りとコンバージョン計測 1 回)は公開 hook useSignupComplete が持ち、
// この部品は見た目だけ。見た目を変える fork は同じルートの _components/ の Screen で hook を呼んで自分で描く
// (処理は写さない。この部品に引数は足さない)

"use client";

import { Link } from "@/components/Navigation";

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Para } from "@/components/TextBlocks";
import { useSignupComplete } from "@/features/core/auth/hooks/useSignupComplete";

export function SignupCompleteSection() {
  const { isChecking } = useSignupComplete();

  if (isChecking) {
    return <ScreenLoader mode="local" className="min-h-[300px]" />;
  }

  return (
    <>
      <UserPageTitle>本登録が完了しました</UserPageTitle>
      <Para>ご登録ありがとうございます。引き続きアプリをお楽しみください。</Para>

      <Block>
        <Button asChild>
          <Link href="/">トップに戻る</Link>
        </Button>
      </Block>
    </>
  );
}
