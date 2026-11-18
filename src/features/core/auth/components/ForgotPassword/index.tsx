// src/features/core/auth/components/ForgotPassword/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/components/Navigation";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input } from "@/components/Form/Input/Manual";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";

import { useForgotPassword } from "@/features/core/auth/hooks/useForgotPassword";

export function ForgotPassword() {
  const { sendResetEmail, isLoading, error, isSuccess } = useForgotPassword();
  const [email, setEmail] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || !email.trim()) return;

    await sendResetEmail(email.trim());
  };

  if (isSuccess) {
    return (
      <Section id="forgot-password" className="w-full">
        <Stack gap="lg" className="text-center">
          <Flex justify="center">
            <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-success/15">
              <CheckCircle className="h-8 w-8 text-success-text" />
            </Flex>
          </Flex>
          <Stack gap="xs">
            <SecTitle size="xl" weight="semiBold" align="inherit">メールを送信しました</SecTitle>
            <Para align="center" size="sm" className="text-muted-foreground">
              {email} 宛にパスワードリセット用のメールを送信しました。
              メール内のリンクをクリックして、新しいパスワードを設定してください。
            </Para>
            <Para align="center" size="sm" className="text-muted-foreground">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </Para>
          </Stack>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              ログイン画面に戻る
            </Link>
          </Button>
        </Stack>
      </Section>
    );
  }

  return (
    <Section id="forgot-password" className="w-full">
      <Stack gap="lg">
        <Stack gap="xs">
          <SecTitle size="xl" weight="semiBold" align="inherit">パスワードをお忘れですか？</SecTitle>
          <Para size="sm" className="text-muted-foreground">
            ご登録のメールアドレスを入力してください。
            パスワードリセット用のリンクをお送りします。
          </Para>
        </Stack>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack gap="xs">
            <Label htmlFor="forgot-password-email" className="block text-foreground">
              メールアドレス
            </Label>
            <Input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              leftIcon={<Mail className="size-4" />}
              placeholder="例）mail@example.com"
              disabled={isLoading}
            />
          </Stack>

          {error && (
            <Para tone="destructive" size="sm">
              {error}
            </Para>
          )}

          <Button type="submit" disabled={isLoading || !email.trim()} className="w-full">
            {isLoading ? "送信中..." : "リセットメールを送信"}
          </Button>
        </form>

        <Block className="text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            ログイン画面に戻る
          </Link>
        </Block>
      </Stack>
    </Section>
  );
}
