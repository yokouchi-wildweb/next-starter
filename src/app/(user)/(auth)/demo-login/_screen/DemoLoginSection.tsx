// src/app/(user)/(auth)/demo-login/_screen/DemoLoginSection.tsx
// デモ開始の操作部品(既定 Screen 専用、契約外)。hook(useDemoLogin)をここで呼ぶ。
// 差し替え Screen は ../_screen/DemoLoginSection を import するか、hook 直結で作り直す

"use client";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Para, SecTitle } from "@/components/TextBlocks";
import { useDemoLogin } from "@/features/core/auth/hooks/useDemoLogin";
import { err } from "@/lib/errors";

type Props = {
  /** デモログイン後の遷移先 */
  redirectTo: string;
};

export function DemoLoginSection({ redirectTo }: Props) {
  const { demoLogin, isLoading, error } = useDemoLogin({ redirectTo });

  const handleClick = async () => {
    try {
      await demoLogin();
    } catch {
      // エラーはフック内で処理済み
    }
  };

  return (
    <Block appearance="surface" padding="xl" className="max-w-md w-full text-center">
      <SecTitle>デモモード</SecTitle>
      <Para tone="muted" className="mt-4">
        デモユーザーとしてログインし、アプリケーションの機能をお試しいただけます。
      </Para>
      <Para tone="muted" size="sm" className="mt-2">
        デモモードでは、データベースへの書き込みはスキップされます。
      </Para>

      {error && (
        <Para tone="destructive" size="sm" className="mt-4">
          {err(error, "デモログインに失敗しました")}
        </Para>
      )}

      <Button
        variant="primary"
        size="lg"
        className="mt-8 w-full"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? "ログイン中..." : "デモを開始"}
      </Button>
    </Block>
  );
}
