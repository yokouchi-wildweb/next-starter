// src/features/auth/components/UserLogin/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input } from "src/components/Form/Manual";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";

import { useEmailPasswordLogin } from "@/features/auth/hooks/useEmailPasswordLogin";
import { log } from "@/utils/log";
import { ThirdPartySignupOptions } from "@/features/auth/components/Signup/ThirdPartySignupOptions";

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
      await signIn({ email, password });
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
      <Block space="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Block space="xs">
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
            />
          </Block>
          <Block space="xs">
            <Label htmlFor="user-login-password" className="block text-foreground">
              パスワード
            </Label>
            <Input
              id="user-login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Block>
          {errorMessage && (
            <Para tone="error" size="sm">
              {errorMessage}
            </Para>
          )}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "ログイン処理中..." : "ログイン"}
          </Button>
        </form>
        <ThirdPartySignupOptions />
      </Block>
    </section>
  );
}
