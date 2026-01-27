// src/features/core/auth/components/ResetPassword/index.tsx

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { PasswordInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

import { useResetPassword } from "@/features/core/auth/hooks/useResetPassword";

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
      <section id="reset-password" className="w-full">
        <Stack space={6} className="text-center">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <Para>リンクを確認しています...</Para>
        </Stack>
      </section>
    );
  }

  // エラー（無効なリンク）
  if (phase === "error" && !email) {
    return (
      <section id="reset-password" className="w-full">
        <Stack space={6} className="text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <Stack space={2}>
            <h2 className="text-xl font-semibold">リンクが無効です</h2>
            <Para size="sm" className="text-muted-foreground">
              {error || "このリンクは無効か、有効期限が切れています。"}
            </Para>
          </Stack>
          <Button variant="outline" asChild className="w-full">
            <Link href="/forgot-password">
              再度パスワードリセットを申請する
            </Link>
          </Button>
        </Stack>
      </section>
    );
  }

  // 完了
  if (phase === "completed") {
    return (
      <section id="reset-password" className="w-full">
        <Stack space={6} className="text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <Stack space={2}>
            <h2 className="text-xl font-semibold">パスワードを変更しました</h2>
            <Para size="sm" className="text-muted-foreground">
              新しいパスワードでログインできるようになりました。
            </Para>
          </Stack>
          <Button asChild className="w-full">
            <Link href="/login">
              ログイン画面へ
            </Link>
          </Button>
        </Stack>
      </section>
    );
  }

  // パスワード入力フォーム
  return (
    <section id="reset-password" className="w-full">
      <Stack space={6}>
        <Stack space={2}>
          <h2 className="text-xl font-semibold">新しいパスワードを設定</h2>
          {email && (
            <Para size="sm" className="text-muted-foreground">
              {email} のパスワードを再設定します。
            </Para>
          )}
        </Stack>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack space={2}>
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

          <Stack space={2}>
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
            <Para tone="error" size="sm">
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
    </section>
  );
}
