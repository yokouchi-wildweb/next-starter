// src/features/core/user/components/UserMyPage/EditEmail.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MailIcon, LoaderIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Label } from "@/components/Form/Label";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { useEmailChange } from "@/features/core/auth/hooks/useEmailChange";

import { AccountPageHeader } from "./AccountPageHeader";

type EditEmailProps = {
  currentEmail: string | null;
};

export function EditEmail({ currentEmail }: EditEmailProps) {
  const router = useRouter();
  const { sendVerification, isLoading, error, isSuccess } = useEmailChange();
  const [editEmail, setEditEmail] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmedEmail = editEmail.trim();
    if (!trimmedEmail) return;

    await sendVerification({ newEmail: trimmedEmail });
  }, [editEmail, sendVerification]);

  const goBack = useCallback(() => {
    router.push("/mypage/account");
  }, [router]);

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader
          title="メールアドレスを編集"
          backHref="/mypage/account"
          backDisabled={isLoading}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {isSuccess ? (
            <Stack space={4} className="text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <MailIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <Stack space={2}>
                <p className="font-medium">確認メールを送信しました</p>
                <p className="text-sm text-muted-foreground">
                  {editEmail} 宛に確認メールを送信しました。
                  メール内のリンクをクリックして変更を完了してください。
                </p>
              </Stack>
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                className="w-full"
              >
                戻る
              </Button>
            </Stack>
          ) : !isChanging ? (
            <Stack space={4} className="text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <MailIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <Stack space={2}>
                <p className="font-medium">現在のメールアドレス</p>
                <p className="text-sm text-muted-foreground">
                  {currentEmail ?? "未設定"}
                </p>
              </Stack>
              <Stack space={2}>
                <Button
                  type="button"
                  onClick={() => setIsChanging(true)}
                  className="w-full"
                >
                  メールアドレスを変更する
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="w-full"
                >
                  戻る
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack space={4}>
              <div>
                <Label className="mb-2 block text-muted-foreground">
                  現在のメールアドレス
                </Label>
                <p className="text-sm">{currentEmail ?? "未設定"}</p>
              </div>
              <div>
                <Label htmlFor="new-email" className="mb-2 block">
                  新しいメールアドレス
                </Label>
                <Input
                  type="email"
                  id="new-email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="新しいメールアドレスを入力"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                新しいメールアドレス宛に確認メールが送信されます。
                メール内のリンクをクリックすると変更が完了します。
              </p>
              <Stack space={2}>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={isLoading || !editEmail.trim()}
                  className="w-full"
                >
                  {isLoading && <LoaderIcon className="h-4 w-4 animate-spin" />}
                  {isLoading ? "送信中..." : "確認メールを送信"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChanging(false)}
                  className="w-full"
                >
                  キャンセル
                </Button>
              </Stack>
            </Stack>
          )}
        </div>
      </Stack>
    </Section>
  );
}
