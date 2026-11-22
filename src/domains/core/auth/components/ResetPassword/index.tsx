// src/domains/core/auth/components/ResetPassword/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/components/Navigation/Link";
import { CheckCircle, AlertCircle } from "lucide-react";
import { InlineLoader } from "@/components/Overlays/Loading";

import { Button } from "@/components/Button/Button";
import { Label } from "@/components/Input/Label";
import { PasswordInput } from "@/components/Input/PasswordInput";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";

import { useResetPassword } from "@/domains/core/auth/hooks/useResetPassword";

type ResetPasswordProps = {
  oobCode: string | null;
};

export function ResetPassword({ oobCode }: ResetPasswordProps) {
  const { phase, email, error, resetPassword } = useResetPassword({ oobCode });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (phase === "submitting" || !newPassword.trim()) return;

    // パスワード確認
    if (newPassword !== confirmPassword) {
      setValidationError("パスワードが一致しません。");
      return;
    }

    if (newPassword.length < 6) {
      setValidationError("パスワードは6文字以上で設定してください。");
      return;
    }

    await resetPassword(newPassword);
  };

  // 検証中
  if (phase === "initial" || phase === "validating") {
    return (
      <Section id="reset-password" className="w-full">
        <InlineLoader size="lg" message="リンクを確認しています..." />
      </Section>
    );
  }

  // エラー（無効なリンク）
  if (phase === "error" && !email) {
    return (
      <Section id="reset-password" className="w-full">
        <Stack gap="lg" className="text-center">
          <Flex justify="center">
            <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive-text" />
            </Flex>
          </Flex>
          <Stack gap="xs">
            <SecTitle size="xl" weight="semiBold" align="inherit">リンクが無効です</SecTitle>
            <Para align="center" size="sm" className="text-muted-foreground">
              {error || "このリンクは無効か、有効期限が切れています。"}
            </Para>
          </Stack>
          <Button variant="outline" asChild className="w-full">
            <Link href="/forgot-password">
              再度パスワードリセットを申請する
            </Link>
          </Button>
        </Stack>
      </Section>
    );
  }

  // 完了
  if (phase === "completed") {
    return (
      <Section id="reset-password" className="w-full">
        <Stack gap="lg" className="text-center">
          <Flex justify="center">
            <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-success/15">
              <CheckCircle className="h-8 w-8 text-success-text" />
            </Flex>
          </Flex>
          <Stack gap="xs">
            <SecTitle size="xl" weight="semiBold" align="inherit">パスワードを変更しました</SecTitle>
            <Para align="center" size="sm" className="text-muted-foreground">
              新しいパスワードでログインできるようになりました。
            </Para>
          </Stack>
          <Button asChild className="w-full">
            <Link href="/login">
              ログイン画面へ
            </Link>
          </Button>
        </Stack>
      </Section>
    );
  }

  // パスワード入力フォーム
  return (
    <Section id="reset-password" className="w-full">
      <Stack gap="lg">
        <Stack gap="xs">
          <SecTitle size="xl" weight="semiBold" align="inherit">新しいパスワードを設定</SecTitle>
          {email && (
            <Para size="sm" className="text-muted-foreground">
              {email} のパスワードを再設定します。
            </Para>
          )}
        </Stack>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack gap="xs">
            <Label htmlFor="new-password" className="block text-foreground">
              新しいパスワード
            </Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="新しいパスワードを入力"
              disabled={phase === "submitting"}
            />
          </Stack>

          <Stack gap="xs">
            <Label htmlFor="confirm-password" className="block text-foreground">
              パスワード（確認）
            </Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="もう一度パスワードを入力"
              disabled={phase === "submitting"}
            />
          </Stack>

          {(error || validationError) && (
            <Para tone="destructive" size="sm">
              {validationError || error}
            </Para>
          )}

          <Para size="sm" className="text-muted-foreground">
            パスワードは6文字以上で設定してください。
          </Para>

          <Button
            type="submit"
            disabled={phase === "submitting" || !newPassword.trim() || !confirmPassword.trim()}
            className="w-full"
          >
            {phase === "submitting" ? "変更中..." : "パスワードを変更"}
          </Button>
        </form>
      </Stack>
    </Section>
  );
}
