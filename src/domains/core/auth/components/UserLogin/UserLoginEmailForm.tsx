// src/domains/core/auth/components/UserLogin/UserLoginEmailForm.tsx

// メールアドレスとパスワードのログインのフォーム(部品)。入力の状態・送信・休会中の復帰画面への移動を自分で持つ。
// 公開 hook useEmailPasswordLogin を呼ぶ。入口 @/domains/core/auth/components/UserLogin から使う(UserLogin もこれを並べる)

"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/components/Navigation/Link";
import { Mail, LockKeyhole } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Label } from "@/components/Input/Label";
import { Input } from "@/components/Input/Input";
import { PasswordInput } from "@/components/Input/PasswordInput";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { useEmailPasswordLogin } from "@/domains/core/auth/hooks/useEmailPasswordLogin";
import { reloadTo } from "@/lib/url";
import { log } from "@/utils/log";

export type UserLoginEmailFormProps = {
  /** ログインの後の移り先(休会中の利用者は /reactivate) */
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function UserLoginEmailForm({ redirectTo = DEFAULT_REDIRECT_PATH }: UserLoginEmailFormProps) {
  const { signIn, isLoading } = useEmailPasswordLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const genericLoginErrorMessage = "ログインが失敗しました";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      // 多重送信防止で処理を中断したことを記録
      log(3, "[UserLoginEmailForm] handleSubmit: already submitting");
      return;
    }

    setErrorMessage(null);
    // メールアドレスでのログイン処理開始を記録
    log(3, "[UserLoginEmailForm] handleSubmit: start", {
      email,
      redirectTo,
    });
    try {
      const { requiresReactivation } = await signIn({ email, password });

      // 休会中ユーザーの場合は復帰画面へリダイレクト
      if (requiresReactivation) {
        log(3, "[UserLoginEmailForm] handleSubmit: requires reactivation, redirecting", {
          email,
        });
        reloadTo("/reactivate");
        return;
      }

      // 利用者が替わる: ページの読み直し(D139)
      reloadTo(redirectTo);
      // メールアドレスでのログイン成功を記録
      log(3, "[UserLoginEmailForm] handleSubmit: login success", {
        email,
        redirectTo,
      });
    } catch (unknownError) {
      // メールアドレスでのログイン失敗内容を記録
      log(3, "[UserLoginEmailForm] handleSubmit: error", {
        email,
        error: unknownError,
      });
      setErrorMessage(genericLoginErrorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Stack gap="xs">
        <Label htmlFor="user-login-email" className="block text-foreground">
          メールアドレス
        </Label>
        <Input
          id="user-login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leftIcon={<Mail className="size-4" />}
          placeholder="例）maile@example.com"
        />
      </Stack>
      <Stack gap="xs">
        <Label htmlFor="user-login-password" className="block text-foreground">
          パスワード
        </Label>
        <PasswordInput
          id="user-login-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          leftIcon={<LockKeyhole className="size-4" />}
          placeholder="ご登録のパスワード"
        />
        <Block className="text-right">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            パスワードをお忘れですか？ ▶
          </Link>
        </Block>
      </Stack>
      {errorMessage && (
        <Para tone="destructive" size="sm">
          {errorMessage}
        </Para>
      )}
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "ログイン処理中..." : "メールアドレスでログイン"}
      </Button>
    </form>
  );
}
