// src/features/core/auth/hooks/useSignupComplete.ts
// 本登録完了(/signup/complete)の処理を持つ公開 hook。遷移の守り(/signup/register からのトークン付き遷移だけを通す、
// 失敗はエラー画面)と、正当な遷移でのサインアップ完了コンバージョン(mount あたり 1 回。env 未設定なら no-op)。
// 画面は hook を呼んで isChecking の間は読み込み中、それ以外は完了の見た目を描くだけ
// (契約: src/features/core/auth/README.md 公開 hook の契約表)

"use client";

import { useEffect } from "react";

import { useGoogleAdsConversion } from "@/lib/googleTag";
import { useTransitionGuard } from "@/lib/transitionGuard";

export function useSignupComplete() {
  const { isChecking, isValidTransition } = useTransitionGuard({
    allowedReferers: ["/signup/register"],
    onFail: { action: "error" },
  });

  // fire は mount あたり 1 回の守りを内包する(useGoogleAdsConversion)
  const { fire } = useGoogleAdsConversion();
  useEffect(() => {
    if (isValidTransition) fire("signup");
  }, [isValidTransition, fire]);

  return { isChecking, isValidTransition } as const;
}
