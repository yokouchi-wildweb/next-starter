// src/features/core/user/components/EditPassword.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { PasswordInput } from "@/components/Form/Input/Manual/PasswordInput";
import { Label } from "@/components/Form/Label";
import { Section } from "@/components/Layout/Section";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { useChangePassword } from "@/features/core/auth/hooks/useChangePassword";

import { AccountPageHeader } from "@/features/core/user/components/common/AccountPageHeader";

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
      <Stack gap="md">
        <AccountPageHeader
          title="パスワードを変更"
          backHref="/mypage/account"
          backDisabled={isLoading}
        />
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {isSuccess ? (
            <Stack gap="md" className="text-center">
              <Flex justify="center">
                <Flex align="center" justify="center" className="h-12 w-12 rounded-full bg-success/15">
                  <CheckCircleIcon className="h-6 w-6 text-success-text" />
                </Flex>
              </Flex>
              <Stack gap="xs">
                <Para size="inherit" weight="medium" align="inherit" className="my-0">パスワードを変更しました</Para>
                <Para size="sm" tone="muted" weight="inherit" align="inherit" className="my-0">
                  新しいパスワードでログインできるようになりました。
                </Para>
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
            <Stack gap="md">
              <Block>
                <Label htmlFor="current-password" className="mb-2 block">
                  現在のパスワード
                </Label>
                <PasswordInput
                  id="current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="現在のパスワードを入力"
                  disabled={isLoading}
                />
              </Block>
              <Block>
                <Label htmlFor="new-password" className="mb-2 block">
                  新しいパスワード
                </Label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新しいパスワードを入力"
                  disabled={isLoading}
                />
              </Block>
              {error && (
                <Para size="sm" tone="destructive" weight="inherit" align="inherit" className="my-0">{error}</Para>
              )}
              <Para size="xs" tone="muted" weight="inherit" align="inherit" className="my-0">
                パスワードは6文字以上で設定してください。
              </Para>
              <Button
                type="button"
                onClick={handleChange}
                disabled={!currentPassword.trim() || !newPassword.trim()}
                loading={isLoading}
                loadingLabel="変更中..."
                className="w-full"
              >
                パスワードを変更
              </Button>
            </Stack>
          )}
        </Block>
      </Stack>
    </Section>
  );
}
