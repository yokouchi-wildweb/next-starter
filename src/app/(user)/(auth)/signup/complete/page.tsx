// src/app/(user)/(auth)/signup/complete/page.tsx

"use client";

import Link from "next/link";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Para } from "@/components/TextBlocks";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { useTransitionGuard } from "@/lib/transitionGuard";

export default function SignUpCompletePage() {
  // 遷移ガード: register からのトークン付き遷移のみ許可
  const { isChecking } = useTransitionGuard({
    allowedReferers: ["/signup/register"],
    onFail: { action: "error" },
  });

  if (isChecking) {
    return (
      <UserPage containerType="narrowStack" className="text-center items-center">
        <ScreenLoader mode="local" className="min-h-[300px]" />
      </UserPage>
    );
  }

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

