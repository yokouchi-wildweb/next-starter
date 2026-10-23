// src/app/(user)/(auth)/signup/complete/_screen/SignupCompleteSection.tsx
// 本登録完了の本文(既定 Screen 専用、契約外)。遷移ガード(useTransitionGuard)と
// コンバージョン計測(useGoogleAdsConversion)をここで呼ぶ。差し替え Screen は ../_screen/SignupCompleteSection を
// import するか、hook 直結で作り直す

"use client";

import Link from "next/link";
import { useEffect } from "react";

import { UserPageTitle } from "@/app/(user)/_layout/PageTitle";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { Para } from "@/components/TextBlocks";
import { useGoogleAdsConversion } from "@/lib/googleTag";
import { useTransitionGuard } from "@/lib/transitionGuard";

export function SignupCompleteSection() {
  // 遷移ガード: register からのトークン付き遷移のみ許可
  const { isChecking, isValidTransition } = useTransitionGuard({
    allowedReferers: ["/signup/register"],
    onFail: { action: "error" },
  });

  // サインアップ完了コンバージョン(正当な遷移時のみ・mount あたり 1 回。env 未設定なら no-op)
  const { fire } = useGoogleAdsConversion();
  useEffect(() => {
    if (isValidTransition) fire("signup");
  }, [isValidTransition, fire]);

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
