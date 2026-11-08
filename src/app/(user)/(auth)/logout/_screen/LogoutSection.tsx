// src/app/(user)/(auth)/logout/_screen/LogoutSection.tsx
// ログアウトの表示部品(既定 Screen 専用、契約外)。処理(mount で 1 回の自動ログアウト)は公開 hook useAutoLogout が持ち、
// この部品は状態の見た目と失敗時の再試行ボタンだけ。
// 見た目を変える fork は同じルートの _components/ の Screen で hook を呼んで自分で描く(この部品に引数は足さない)

"use client";

import { Para } from "@/components/TextBlocks";
import { LogoutButton } from "@/features/core/auth/components/common/LogoutButton";
import { useAutoLogout } from "@/features/core/auth/hooks/useAutoLogout";

type Props = {
  /** ログアウト後の遷移先(loader が内部パスに限定済み) */
  redirectTo: string;
};

export function LogoutSection({ redirectTo }: Props) {
  const { isLoading, error } = useAutoLogout({ redirectTo });

  if (error) {
    return (
      <>
        <Para>ログアウトに失敗しました</Para>
        <LogoutButton redirectTo={redirectTo} />
      </>
    );
  }

  return <Para>{isLoading ? "ログアウト中..." : "リダイレクト中..."}</Para>;
}
