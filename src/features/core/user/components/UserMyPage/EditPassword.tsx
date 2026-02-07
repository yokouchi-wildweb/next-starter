// src/features/core/user/components/UserMyPage/EditPassword.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon, CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { PasswordInput } from "@/components/Form/Input/Manual/PasswordInput";
import { Label } from "@/components/Form/Label";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { useChangePassword } from "@/features/core/auth/hooks/useChangePassword";

import { AccountPageHeader } from "./AccountPageHeader";

type EditPasswordProps = {
  email: string;
};

export function EditPassword({ email }: EditPasswordProps) {
  const router = useRouter();
  const { changePassword, isLoading, error, isSuccess } = useChangePassword({ email });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleChange = useCallback(async () => {
    if (!currentPassword.trim() || !newPassword.trim()) return;

    await changePassword(currentPassword, newPassword);
  }, [currentPassword, newPassword, changePassword]);

  const goBack = useCallback(() => {
    router.push("/mypage/account");
  }, [router]);

  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader
          title="パスワードを変更"
          backHref="/mypage/account"
          backDisabled={isLoading}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {isSuccess ? (
            <Stack space={4} className="text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <Stack space={2}>
                <p className="font-medium">パスワードを変更しました</p>
                <p className="text-sm text-muted-foreground">
                  新しいパスワードでログインできるようになりました。
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
          ) : (
            <Stack space={4}>
              <div>
                <Label htmlFor="current-password" className="mb-2 block">
                  現在のパスワード
                </Label>
                <PasswordInput
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="現在のパスワードを入力"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="mb-2 block">
                  新しいパスワード
                </Label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新しいパスワードを入力"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                パスワードは6文字以上で設定してください。
              </p>
              <Button
                type="button"
                onClick={handleChange}
                disabled={isLoading || !currentPassword.trim() || !newPassword.trim()}
                className="w-full"
              >
                {isLoading && <LoaderIcon className="h-4 w-4 animate-spin" />}
                {isLoading ? "変更中..." : "パスワードを変更"}
              </Button>
            </Stack>
          )}
        </div>
      </Stack>
    </Section>
  );
}
