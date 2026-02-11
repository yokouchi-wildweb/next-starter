// src/features/auth/components/UserLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, LockKeyhole } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input, PasswordInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { useEmailPasswordLogin } from "@/features/core/auth/hooks/useEmailPasswordLogin";
import { log } from "@/utils/log";
import { ThirdPartySignupOptions } from "@/features/core/auth/components/Signup/ThirdPartySignupOptions";

export type UserLoginProps = {
  redirectTo?: string;
};

const DEFAULT_REDIRECT_PATH = "/";

export function UserLogin({ redirectTo = DEFAULT_REDIRECT_PATH }: UserLoginProps) {
  const router = useRouter();
  const { signIn, isLoading } = useEmailPasswordLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const genericLoginErrorMessage = "ログインが失敗しました";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      // 多重送信防止で処理を中断したことを記録
      log(3, "[UserLogin] handleSubmit: already submitting");
      return;
    }

    setErrorMessage(null);
    // メールアドレスでのログイン処理開始を記録
    log(3, "[UserLogin] handleSubmit: start", {
      email,
      redirectTo,
    });
    try {
      const { requiresReactivation } = await signIn({ email, password });

      // 休会中ユーザーの場合は復帰画面へリダイレクト
      if (requiresReactivation) {
        log(3, "[UserLogin] handleSubmit: requires reactivation, redirecting", {
          email,
        });
        router.push("/reactivate");
        router.refresh();
        return;
      }

      router.push(redirectTo);
      router.refresh();
      // メールアドレスでのログイン成功を記録
      log(3, "[UserLogin] handleSubmit: login success", {
        email,
        redirectTo,
      });
    } catch (unknownError) {
      // メールアドレスでのログイン失敗内容を記録
      log(3, "[UserLogin] handleSubmit: error", {
        email,
        error: unknownError,
      });
      setErrorMessage(genericLoginErrorMessage);
    }
  };

  return (
    <section id="user-login" className="w-full">
      <Stack space={8}>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack space={2}>
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
          <Stack space={2}>
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
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                パスワードをお忘れですか？ ▶
              </Link>
            </div>
          </Stack>
          {errorMessage && (
            <Para tone="error" size="sm">
              {errorMessage}
            </Para>
          )}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "ログイン処理中..." : "メールアドレスでログイン"}
          </Button>
        </form>
        <ThirdPartySignupOptions redirectTo={redirectTo} />

        <div className="mt-8">
          <Button variant="outline" asChild className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <Link href="/signup">
              新規での会員登録はこちら <span className="ml-1 text-xs">▶</span>
            </Link>
          </Button>
        </div>
      </Stack>
    </section>
  );
}
